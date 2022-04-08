(function () {
  const vscode = acquireVsCodeApi();

  const main = document.getElementById("main");

  // Handle messages sent from the extension to the webview
  window.addEventListener("message", (event) => {
    const message = event.data; // The json data that the extension sent
    switch (message.type) {
    }
  });
})();
