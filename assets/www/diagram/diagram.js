//@js-check

(function () {
  const vscode = acquireVsCodeApi();

  // function to set the contents of the preview div
  function updatePreview(content) {
    // first clear it out
    const previewDiv = document.querySelector("#diagram-preview");
    while (previewDiv.firstChild) {
      previewDiv.removeChild(previewDiv.firstChild);
    }
    // set innerHTML or append child as appropriate
    if (content) {
      document.body.classList.add("with-preview");
      if (typeof content === "string" || content instanceof String) {
        previewDiv.innerHTML = content;
      } else {
        previewDiv.appendChild(content);
      }
    } else {
      document.body.classList.remove("with-preview");
      const noPreview = document.createElement("p");
      noPreview.id = "no-preview-available";
      noPreview.innerText = "No diagram currently selected";
      previewDiv.appendChild(noPreview);
    }
  }

  // initialize mermaid and graphviz
  const mermaidApi = window.mermaid.mermaidAPI;
  mermaidApi.initialize({ startOnLoad: false });
  const hpccWasm = window["@hpcc-js/wasm"];
  hpccWasm.graphvizSync().then((graphviz) => {
    // always start with no preview
    updatePreview(null);

    // remember the last message and skip processing if its identical
    // to the current message (e.g. would happen on selection change)
    let lastMessage = undefined;

    // handle messages sent from the extension to the webview
    window.addEventListener("message", (event) => {
      // get the message
      const message = event.data;

      // skip if its the same as the last message
      if (
        lastMessage &&
        lastMessage.type === message.type &&
        lastMessage.engine === message.engine &&
        lastMessage.src === message.src
      ) {
        return;
      }

      // set last message
      lastMessage = message;

      // handle the message
      if (message.type === "render") {
        vscode.postMessage({ type: "render-begin" });
        try {
          switch (message.engine) {
            case "mermaid": {
              const kMermaidId = "mermaidSvg";
              mermaidApi.render(kMermaidId, message.src, () => {
                const mermaidEl = document.querySelector(`#${kMermaidId}`);
                updatePreview(mermaidEl);
              });
              break;
            }
            case "graphviz": {
              updatePreview(graphviz.layout(message.src, "svg", "dot"));
              break;
            }
          }
        } finally {
          vscode.postMessage({ type: "render-end" });
        }
      } else if (message.type === "clear") {
        updatePreview(null);
      }
    });

    // signal that we are ready to receive messages
    vscode.postMessage({ type: "initialized" });
  });
})();
