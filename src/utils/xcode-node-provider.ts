import * as vscode from 'vscode';
import { TreeExplorerNodeProvider } from 'vscode'
import * as xcode from 'xcode-proj'
import * as fs from 'fs'
import * as path from 'path'
import { Promise } from 'es6-promise'

export class XcodeNodeProvider implements TreeExplorerNodeProvider<XcodeTreeNode> {

  constructor(public rootPath: string) { }

    /**
		 * Provide the root node. This function will be called when the tree explorer is activated
		 * for the first time. The root node is hidden and its direct children will be displayed on the first level of
		 * the tree explorer.
		 *
		 * @return The root node.
		 */
		provideRootNode() {
      return new Root(this.rootPath)
    }

		/**
		 * Resolve the children of `node`.
		 *
		 * @param node The node from which the provider resolves children.
		 * @return Children of `node`.
		 */
		resolveChildren(node: XcodeTreeNode): XcodeTreeNode[] | Thenable<XcodeTreeNode[]> {
      return node.children();
    }

		/**
		 * Provide a human-readable string that will be used for rendering the node. Default to use
		 * `node.toString()` if not provided.
		 *
		 * @param node The node from which the provider computes label.
		 * @return A human-readable label.
		 */
		getLabel?(node: XcodeTreeNode): string {
      return node.label()
    }

		/**
		 * Determine if `node` has children and is expandable. Default to `true` if not provided.
		 *
		 * @param node The node to determine if it has children and is expandable.
		 * @return A boolean that determines if `node` has children and is expandable.
		 */
		getHasChildren?(node: XcodeTreeNode): boolean {
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
		getClickCommand?(node: XcodeTreeNode): string {
      return node.clickCommand ? node.clickCommand() : null
    }
}

interface XcodeTreeNode {

  hasChildren : boolean
  
  children() : XcodeTreeNode[] | Thenable<XcodeTreeNode[]>
  
  label() : string

  clickCommand?()  : string
}
	

class Root implements XcodeTreeNode {

  hasChildren = true
	
  constructor(public path: string) { }

  children() : XcodeTreeNode[] {

    return (<string[]>fs.readdirSync(this.path))
      .filter((file) => file.match(/\.xcodeproj$/))
      .map((file) => new Project(this.path, file));
  }

  label() : string {
    return "Xcode"
  }
}

class Project implements XcodeTreeNode {

  hasChildren = true
	
  constructor(public path: string, public file: string) { }

  children() : Thenable<XcodeTreeNode[]> {

    return new Promise<XcodeTreeNode[]>((resolve, reject) => {
      
      const proj = xcode.project(path.join(this.path, this.file, 'project.pbxproj'))
      proj.parseSync()

      const projSection = proj.pbxProjectSection()
      const groups = proj.getPBXGroupByKey(projSection[proj.hash.project.rootObject].mainGroup).children.map((child) => {
        return new Group(proj, child)
      })
      
      resolve(groups)
    })
  }

  label() : string {
    return this.file
  }
}

class Group implements XcodeTreeNode {

  hasChildren = true
	
  constructor(public project: any, public data: any) { }

  children() : Thenable<XcodeTreeNode[]> {

    return new Promise<XcodeTreeNode[]>((resolve, reject) => {
      

      const groups = this.project.getPBXGroupByKey(this.data.value).children
        .filter((child) => this.project.getPBXGroupByKey(child.value))
        .map((child) => new Group(this.project, child))
      
      const files = this.project.getPBXGroupByKey(this.data.value).children
        .map((child) => ({ data: child, file: this.file(child.value) }))
        .filter((file) => file.file)
        .map((file) => new File(this.project, file.data, file.file))

      
      resolve([].concat(groups, files));
    })

    
  }

  label() : string {
    return this.data.comment
  }

  private file(key: string): any {
    const files = this.project.pbxFileReferenceSection();
    return files[key]
  }
}

class File implements XcodeTreeNode {

  hasChildren = false
	
  constructor(public project: any, public data: any, public file: any) { }

  children() : Thenable<XcodeTreeNode[]> {
    return null
  }

  label() : string {
    return this.data.comment
  }

  clickCommand()  : string {
    console.log('file', this.file)
    return null
  }
}