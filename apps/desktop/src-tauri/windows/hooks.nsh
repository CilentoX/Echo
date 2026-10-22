; Echo installer hooks — remove a instalação antiga do "Eco" (identifier diferente
; fazia o NSIS instalar em paralelo e o updater entrava em loop).
; Executa o uninstaller antigo silenciosamente antes de copiar os arquivos novos.

!macro NSIS_HOOK_PREINSTALL
  ; Procura o uninstaller do Eco antigo nas duas hives do registry.
  ; O NSIS do Tauri registra em HKCU (currentUser) ou HKLM (perMachine),
  ; sob a chave com o nome do produto.
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Eco" "UninstallString"
  ${If} $0 == ""
    ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Eco" "UninstallString"
  ${EndIf}

  ${If} $0 != ""
    DetailPrint "Removendo instalacao antiga do Eco..."
    ; Rode o uninstaller em modo silencioso e espere terminar antes de prosseguir.
    ExecWait '"$0" /S _?=$INSTDIR'
    Delete "$0"
  ${EndIf}
!macroend
