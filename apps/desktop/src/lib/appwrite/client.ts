import { Client, Account, Storage, Databases } from "appwrite"
import { APPWRITE_CONFIG } from "./config"

/**
 * Cliente Appwrite configurado com endpoint e project ID do projeto Echo.
 * Instância única compartilhada por toda a aplicação.
 * Nota: o SDK web não expõe setApiKey; a chave é enviada via header
 * X-Appwrite-Key nas chamadas REST do storage.ts.
 */
export const client = new Client()
  .setEndpoint(APPWRITE_CONFIG.endpoint)
  .setProject(APPWRITE_CONFIG.projectId)

/**
 * Serviços Appwrite inicializados com o client configurado.
 */
export const account = new Account(client)
export const storage = new Storage(client)
export const databases = new Databases(client)

/**
 * Verifica a conexão com o Appwrite executando um ping.
 * Deve ser chamado uma vez na inicialização da aplicação.
 */
export async function pingAppwrite(): Promise<void> {
  try {
    const response = await client.ping()
    console.log("[Appwrite] Conexão OK:", response)
  } catch (err) {
    console.error("[Appwrite] Falha na conexão:", err)
    throw err
  }
}
