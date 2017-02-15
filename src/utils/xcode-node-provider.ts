import * as vscode from 'vscode';
import { TreeExplorerNodeProvider, workspace } from 'vscode'
import * as xcode from 'xcode-proj'
import * as fs from 'fs'
import * as path from 'path'

export class XcodeNodeProvider implements TreeExplorerNodeProvider<XcodeNode> {

  constructor(public rootPath: string) {}

    /**
		 * Provide the root node. This function will be called when the tree explorer is activated
		 * for the first time. The root node is hidden and its direct children will be displayed on the first level of
		 * the tree explorer.
		 *
		 * @return The root node.
		 */
		provideRootNode() {
      return new RootNode(this.rootPath)
    }

		/**
		 * Resolve the children of `node`.
		 *
		 * @param node The node from which the provider resolves children.
		 * @return Children of `node`.
		 */
		resolveChildren(node: XcodeNode): XcodeNode[] | Thenable<XcodeNode[]> {

      let children = node.children()

      const config = workspace.getConfiguration()
      const sortAlphabetically = config.get<boolean>('xcodeProject.sortAlphabetically');

      if (sortAlphabetically) {
        children = Array.isArray(children)
          ? children.sort((a, b) => a.sortKey().localeCompare(b.sortKey()))
          : children.then((children) => children.sort((a, b) => a.sortKey().localeCompare(b.sortKey())))
      }
      
      return children;
    }

		/**
		 * Provide a human-readable string that will be used for rendering the node. Default to use
		 * `node.toString()` if not provided.
		 *
		 * @param node The node from which the provider computes label.
		 * @return A human-readable label.
		 */
		getLabel?(node: XcodeNode): string {
      return node.label()
    }

		/**
		 * Determine if `node` has children and is expandable. Default to `true` if not provided.
		 *
		 * @param node The node to determine if it has children and is expandable.
		 * @return A boolean that determines if `node` has children and is expandable.
		 */
		getHasChildren?(node: XcodeNode): boolean {
      return node.hasChildren;
    }

		/**
		 * Get the command to execute when `node` is clicked.
		 *
		 * Commands can be registered through [registerCommand](#commands.registerCommand). `node` will be provided
		 * as the first argument to the command's callback function.
		 *
		 * @param node The node that the command is associated with.
		 * @return The command to execute when `node` is clicked.
		 */
		getClickCommand?(node: XcodeNode): string {
      return node.clickCommand
    }
}

export abstract class XcodeNode {

  hasChildren : boolean = false

  clickCommand? : string = null

  sortKey() : string {
    return `001-${this.label()}`
  }
  
  abstract children() : XcodeNode[] | Thenable<XcodeNode[]>
  
  abstract label() : string

  abstract path() : string
}
	

class RootNode extends XcodeNode {

  hasChildren = true
	
  constructor(public rootPath: string) {
    super()
  }

  children() : XcodeNode[] {
    return fs.readdirSync(this.rootPath)
      .filter((file) => file.match(/\.xcodeproj$/))
      .map((file) => new ProjectNode(file, this));
  }

  label() : string {
    return "Xcode"
  }

  path() : string {
    // console.log(`RootNode ${this.label()}:`, this.rootPath);
    return this.rootPath
  }
}

class ProjectNode extends XcodeNode {

  hasChildren = true
	
  constructor(public file: string, public parent: RootNode) {
    super()
  }

  children() : Thenable<XcodeNode[]> {

    return new Promise<XcodeNode[]>((resolve, reject) => {
      
      const proj = xcode.project(path.join(this.parent.rootPath, this.file, 'project.pbxproj'))
      proj.parseSync()

      const projSection = proj.pbxProjectSection()
      const groups = proj.getPBXGroupByKey(projSection[proj.hash.project.rootObject].mainGroup).children
        .map((child) => new GroupNode(proj, child, this))
      
      resolve(groups)
    })
  }

  label() : string {
    return this.file
  }

  path() : string {
    // console.log(`ProjectNode ${this.label()}:`, '');
    return path.join(this.parent.path())
  }
}

class GroupNode extends XcodeNode {

  hasChildren = true
	
  constructor(public project: any, public data: any, public parent: XcodeNode) {
    super()
  }

  children() : Thenable<XcodeNode[]> {

    return new Promise<XcodeNode[]>((resolve, reject) => {

      const bfileSec =  this.project.pbxBuildFileSection()
      const bfileKeys =  Object.keys(bfileSec)

      const children = this.group().children
        .map((child) => {

          const { value } = child;

          if (this.project.getPBXGroupByKey(value)) {
            return new GroupNode(this.project, child, this)
          
          } else if (this.project.pbxFileReferenceSection()[value]) {
            return new FileNode(this.project, child, this)
          }

          const bfileKey = bfileKeys.find((key) => bfileSec[key].fileRef === value)
          const bfile = bfileSec[bfileKey]

          if (bfile) {
            return new BuildFileNode(this.project, bfile, this)
          }

          console.warn(`Unknown child ${JSON.stringify(child)}`)
          
        })
        .filter((node) => node)
  
      resolve(children)
    })
  }

  label() : string {
    return this.data.comment
  }

  sortKey() : string {
    const directoriesFirst = workspace.getConfiguration().get<boolean>('xcodeProject.directoriesFirst');
    const prefix = directoriesFirst ? '000' : '001'
    
    return `${prefix}-${this.label()}`
  }

  path() : string {

    const parentPath = this.parent.path()
    const grouPath = this.group().path

    // console.log(`GroupNode ${this.label()}:`, grouPath);

    return grouPath ? path.join(parentPath, grouPath) : parentPath
  }

  private group() : any {
    return this.project.getPBXGroupByKey(this.data.value)
  }

  private file(key: string): any {
    const files = this.project.pbxFileReferenceSection();
    return files[key]
  }
}

export class BuildFileNode extends XcodeNode {

  hasChildren = false

  clickCommand = null
	
  constructor(public project: any, public data: any, public parent: GroupNode) {
    super()
  }

  children() : Thenable<XcodeNode[]> {
    return null
  }

  label() : string {
    return this.data.fileRef_comment
  }

  path() : string {

    // console.log(`BuildFileNode ${this.label()}:`, this.data.fileRef_comment);

    return path.join(this.parent.path(), this.data.fileRef_comment)
  }  
}

export class FileNode extends XcodeNode {

  hasChildren = false

  clickCommand = 'extension.openXcodeFileNode'
	
  constructor(public project: any, public data: any, public parent: GroupNode) {
    super()
  }

  children() : Thenable<XcodeNode[]> {
    return null
  }

  label() : string {
    return this.data.comment
  }

  path() : string {

    const refs = this.project.pbxFileReferenceSection()
    const ref = refs[this.data.value]

    const fileName = ref.path.replace(/(^"|"$)/g, '');

    // console.log(`FileNode ${this.label()}:`, fileName);

    return path.join(this.parent.path(), fileName)
  }  
}