'use strict';

import * as vscode from 'vscode';
import { XcodeNodeProvider } from './utils/xcode-node-provider'

export function activate(context: vscode.ExtensionContext) {
  const rootPath = vscode.workspace.rootPath;
  vscode.window.registerTreeExplorerNodeProvider('XcodeProject', new XcodeNodeProvider(rootPath));
}

// this method is called when your extension is deactivated
export function deactivate() {}
