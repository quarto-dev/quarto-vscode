//@js-check

(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  window.mermaid.mermaidAPI.initialize({ startOnLoad: false });

  const kMermaidId = "mermaidId";
  const graphDefinition = "graph TB\na-->b";
  const graph = mermaid.mermaidAPI.render(
    kMermaidId,
    graphDefinition,
    (svg) => {
      const mermaidEl = document.querySelector(`#${kMermaidId}`);
      const graphDiv = document.querySelector("#graphDiv");
      graphDiv.appendChild(mermaidEl);
    }
  );

  const dot = `
            digraph G {
                node [shape=rect];

                subgraph cluster_0 {
                    style=filled;
                    color=lightgrey;
                    node [style=filled,color=white];
                    a0 -> a1 -> a2 -> a3;
                    label = "Hello";
                }

                subgraph cluster_1 {
                    node [style=filled];
                    b0 -> b1 -> b2 -> b3;
                    label = "World";
                    color=blue
                }

                start -> a0;
                start -> b0;
                a1 -> b3;
                b2 -> a3;
                a3 -> a0;
                a3 -> end;
                b3 -> end;

                start [shape=Mdiamond];
                end [shape=Msquare];
            }
        `;

  const hpccWasm = window["@hpcc-js/wasm"];
  hpccWasm.graphviz.layout(dot, "svg", "dot").then((svg) => {
    const div = document.getElementById("graphvizDiv");
    div.innerHTML = svg;
  });

  const main = document.getElementById("main");

  // Handle messages sent from the extension to the webview
  let contentShown = false;
  window.addEventListener("message", (event) => {
    const message = event.data; // The json data that the extension sent
    switch (message.type) {
      case "update": {
        updateContent(message.body);
        contentShown = true;
        break;
      }
      case "noContent": {
        if (!contentShown) {
          setNoContent(message.body);
        } else if (message.updateMode === "live") {
          setNoContent("");
        }
        break;
      }
    }
  });

  /**
   * @param {string} contents
   */
  function updateContent(contents) {
    main.innerHTML = contents;
    window.scrollTo(0, 0);
  }

  /**
   * @param {string} message
   */
  function setNoContent(message) {
    main.innerHTML = `<p class="no-content">${message}</p>`;
  }
})();
