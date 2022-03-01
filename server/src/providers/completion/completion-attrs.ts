import { EditorContext } from "../../quarto";

export async function attrCompletions(context: EditorContext) {
  // bypass if the current line doesn't contain a {
  if (context.line.indexOf("{") !== -1) {
    // ^([\t >]*)(`{3,}|\#+|:{3,}).*?\{(.*?)\}[ \t]*$
    // \[([^\]]*?)\]\(\s*(.*?)\)\{.*?\}
  } else {
    return null;
  }
}
