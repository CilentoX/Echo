import React from "react"
import ReactDOM from "react-dom/client"
import "@fontsource/inter"
import "@fontsource/space-grotesk"
import "./styles.css"
import App from "./App"
import { pingAppwrite } from "@/lib/appwrite/client"

// Verifica a conexão com o Appwrite ao iniciar a aplicação
pingAppwrite()

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
