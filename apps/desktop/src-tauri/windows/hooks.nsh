; Echo installer hooks — higienização de versões legadas e registro de protocolos nativos.
; Executa silenciosamente durante a instalação ou auto-atualização do NSIS.

!macro NSIS_HOOK_PREINSTALL
  ; 1. Procura e desinstala qualquer versão antiga do "Eco" (identifier legado)
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Eco" "UninstallString"
  ${If} $0 == ""
    ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Eco" "UninstallString"
  ${EndIf}

  ${If} $0 != ""
    DetailPrint "Removendo instalacao antiga do Eco..."
    ExecWait '"$0" /S _?=$INSTDIR'
    Delete "$0"
  ${EndIf}

  ; 2. Remove executável legado 'desktop.exe' se existir no diretório de instalação
  ${If} ${FileExists} "$INSTDIR\desktop.exe"
    DetailPrint "Removendo binario legado desktop.exe..."
    Delete /REBOOTOK "$INSTDIR\desktop.exe"
  ${EndIf}

  ; 3. Remove atalhos antigos com o nome desktop.lnk
  ${If} ${FileExists} "$DESKTOP\desktop.lnk"
    Delete "$DESKTOP\desktop.lnk"
  ${EndIf}
  ${If} ${FileExists} "$SMPROGRAMS\Echo\desktop.lnk"
    Delete "$SMPROGRAMS\Echo\desktop.lnk"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Limpeza defensiva de atalhos legados
  ${If} ${FileExists} "$DESKTOP\desktop.lnk"
    Delete "$DESKTOP\desktop.lnk"
  ${EndIf}

  ; Registra o protocolo echo:// no Windows para deep linking nativo (ex: convites echo://invite/...)
  WriteRegStr HKCU "Software\Classes\echo" "" "URL:Echo Protocol"
  WriteRegStr HKCU "Software\Classes\echo" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\echo\shell\open\command" "" '"$INSTDIR\Echo.exe" "%1"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegKey HKCU "Software\Classes\echo"
!macroend
