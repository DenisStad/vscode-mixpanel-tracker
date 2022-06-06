// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import * as Mixpanel from "mixpanel";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // // Use the console to output diagnostic information (console.log) and errors (console.error)
  // // This line of code will only be executed once when your extension is activated
  // console.log('Congratulations, your extension "mixpanel-tracker" is now active!');

  // // The command has been defined in the package.json file
  // // Now provide the implementation of the command with registerCommand
  // // The commandId parameter must match the command field in package.json
  // let disposable = vscode.commands.registerCommand('mixpanel-tracker.helloWorld', () => {
  // 	// The code you place here will be executed every time your command is executed
  // 	// Display a message box to the user
  // 	vscode.window.showInformationMessage('Hello World from mixpanel-tracker!');
  // });

  // context.subscriptions.push(disposable);

  console.log("Initing mixpanel tracker");

  const token = vscode.workspace
    .getConfiguration("mixpanel")
    .get("mixpanelToken");

  if (token) {
    const mixpanel = Mixpanel.init(token as string);

  //   // mixpanel.track("init", {
  //   //   distinct_id: vscode.env.machineId,
  //   //   properties: {},
  //   // });

    async function trackDocumentEvent(
      name: string,
      document: vscode.TextDocument
    ) {
      const info = await getGitInfo(document);

      const event: any = {
        distinct_id: vscode.env.machineId,
        uri: document.uri.toString(),
        filename: document.fileName,
        fileVersion: document.version,
        languageId: document.languageId,
        ...(info ?? {}),
      };

      mixpanel.track(name, event);
    }

    console.log("Registering hooks");

    vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) =>
      trackDocumentEvent("VS Code Open File", document)
    );
    vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) =>
      trackDocumentEvent("VS Code Save File", document)
    );
    vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) =>
      trackDocumentEvent("VS Code Close File", document)
    );
  }
}

async function getGitInfo(document: vscode.TextDocument) {
  let uri = document.uri.fsPath;
  let safetyCount = 0;

  while (true) {
    try {
      const headFile = path.join(uri, ".git", "HEAD");
      const headUri = vscode.Uri.file(headFile);
      const configFile = path.join(uri, ".git", "config");
      const configUri = vscode.Uri.file(configFile);

      const headContent = Buffer.from(
        await vscode.workspace.fs.readFile(headUri)
      ).toString("utf8");
      let branchName;

      if (headContent.startsWith("ref: refs/heads/")) {
        branchName = headContent.replace(/^(ref: refs\/heads\/\.*)/, "").trim();
      }

      const configContent = Buffer.from(
        await vscode.workspace.fs.readFile(configUri)
      ).toString("utf8");

      const allRepos = configContent
        .split("\n")
        .map((line) => {
          const matches = line.match(/url\W*=\W*(.+)$/);
          return matches?.[1]?.trim();
        })
        .filter(Boolean);
      const firstRepo = allRepos[0];

      return {
        repository: allRepos.length === 1 ? firstRepo : undefined,
        repositories: allRepos,
        branchName,
      };
    } catch (err) {
      if ((err as any).code === "ENOENT") {
        // ignore
      // } else {
      //   throw err;
      }
    }
    const nextPath = path.resolve(uri, "..");
    if (nextPath === uri || safetyCount > 50) {
      break;
    }
    uri = nextPath;
    safetyCount++;
  }
}

// this method is called when your extension is deactivated
export function deactivate() {}
