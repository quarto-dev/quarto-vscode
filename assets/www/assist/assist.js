//@ts-check

(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  const main = document.getElementById("main");

  // Handle messages sent from the extension to the webview
  window.addEventListener("message", (event) => {
    const message = event.data; // The json data that the extension sent
    switch (message.type) {
      case "update": {
        updateContent(message.body);
        break;
      }
      case "noContent": {
        setNoContent(message.body);
        break;
      }
    }
  });

  /**
   * @param {string} contents
   */
  function updateContent(contents) {
    main.innerHTML = contents;
  }

  /**
   * @param {string} message
   */
  function setNoContent(message) {
    main.innerHTML = `<p class="no-content">${message}</p>`;
  }
})();
