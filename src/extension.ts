'use strict';

import * as vscode from 'vscode';
import { XcodeNodeProvider, FileNode } from './utils/xcode-node-provider'

export function activate(context: vscode.ExtensionContext) {
  const rootPath = vscode.workspace.rootPath;
  
  vscode.window.registerTreeExplorerNodeProvider('XcodeProject', new XcodeNodeProvider(rootPath));
  
  vscode.commands.registerCommand('extension.openXcodeFileNode', (node: FileNode) => {
		const fileUri = vscode.Uri.parse(`file://${node.path()}`) ;
    vscode.workspace.openTextDocument(fileUri)
      .then((doc) => vscode.window.showTextDocument(doc));
	})
}

// this method is called when your extension is deactivated
export function deactivate() {}
