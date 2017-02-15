import * as vscode from 'vscode';
import { TreeExplorerNodeProvider } from 'vscode'
import * as xcode from 'xcode-proj'
import * as fs from 'fs'
import * as path from 'path'

export class XcodeNodeProvider implements TreeExplorerNodeProvider<XcodeNode> {

  constructor(public rootPath: string) { }

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
      // TODO add option to sort alphabetically
      return node.children();
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

export interface XcodeNode {

  hasChildren : boolean

  clickCommand? : string
  
  children() : XcodeNode[] | Thenable<XcodeNode[]>
  
  label() : string

  path() : string
}
	

class RootNode implements XcodeNode {

  hasChildren = true
	
  constructor(public rootPath: string) { }

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

class ProjectNode implements XcodeNode {

  hasChildren = true
	
  constructor(public file: string, public parent: RootNode) { }

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

class GroupNode implements XcodeNode {

  hasChildren = true
	
  constructor(public project: any, public data: any, public parent: XcodeNode) { }

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

export class BuildFileNode implements XcodeNode {

  hasChildren = false

  clickCommand = null
	
  constructor(public project: any, public data: any, public parent: GroupNode) { }

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

export class FileNode implements XcodeNode {

  hasChildren = false

  clickCommand = 'extension.openXcodeFileNode'
	
  constructor(public project: any, public data: any, public parent: GroupNode) { }

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