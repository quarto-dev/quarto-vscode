//@ts-check

(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  const main = document.getElementById("main");

  let contentShown = false;

  // Handle messages sent from the extension to the webview
  window.addEventListener("message", (event) => {
    const message = event.data; // The json data that the extension sent
    switch (message.type) {
      case "update": {
        updateContent(message.body);
        contentShown = true;
        break;
      }
      case "noContent": {
        setNoContent(!contentShown ? message.body : "");
        contentShown = true;
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
