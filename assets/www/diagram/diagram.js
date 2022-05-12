//@js-check

(function () {
  const vscode = acquireVsCodeApi();

  // clear preview
  function clearPreview() {
    document.body.classList.remove("with-preview");
    document.body.classList.remove("mermaid");
    document.body.classList.remove("graphviz");
    const noPreview = document.createElement("p");
    noPreview.innerText = "No diagram currently selected";
    const previewDiv = document.querySelector("#no-preview");
    previewDiv.appendChild(noPreview);
  }

  // function to set the contents of the preview div
  function updateMermaidPreview(el) {
    document.body.classList.add("with-preview");
    document.body.classList.add("mermaid");
    document.body.classList.remove("graphviz");
    const previewDiv = document.querySelector("#mermaid-preview");
    while (previewDiv.firstChild) {
      previewDiv.removeChild(previewDiv.firstChild);
    }
    previewDiv.appendChild(el);
  }

  function updateGraphvizPreview(svg) {
    document.body.classList.add("with-preview");
    document.body.classList.add("graphviz");
    document.body.classList.remove("mermaid");
    const previewDiv = document.querySelector("#graphviz-preview");
    previewDiv.innerHTML = svg;
  }

  // initialize mermaid and graphviz
  const mermaidApi = window.mermaid.mermaidAPI;
  mermaidApi.initialize({ startOnLoad: false });
  const hpccWasm = window["@hpcc-js/wasm"];
  hpccWasm.graphvizSync().then((graphviz) => {
    // always start with no preview
    clearPreview();

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
                updateMermaidPreview(mermaidEl);
              });
              break;
            }
            case "graphviz": {
              updateGraphvizPreview(graphviz.layout(message.src, "svg", "dot"));
              break;
            }
          }
        } finally {
          vscode.postMessage({ type: "render-end" });
        }
      } else if (message.type === "clear") {
        clearPreview();
      }
    });

    // signal that we are ready to receive messages
    vscode.postMessage({ type: "initialized" });
  });
})();
