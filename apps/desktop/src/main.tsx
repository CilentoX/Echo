import React from "react"
import ReactDOM from "react-dom/client"
import "@fontsource/inter"
import "@fontsource/space-grotesk"
import "./styles.css"
import App from "./App"
import { pingEchoApi } from "@/lib/api/config"

// Verifica a conexão com a Echo API ao iniciar a aplicação
pingEchoApi()

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
