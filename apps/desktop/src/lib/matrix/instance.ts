import { MatrixService } from "./service";
import { ECHO_HOMESERVER_URL } from "./sso";

/**
 * Singleton do MatrixService para todo o app: client factory padrão
 * (matrix-js-sdk real) apontando para o homeserver da rede Eco.
 * SessionGate, stores e telas compartilham esta mesma instância,
 * para que o client credentialled criado no login seja o mesmo usado
 * na sincronização.
 */
export const matrixService = new MatrixService(ECHO_HOMESERVER_URL);
