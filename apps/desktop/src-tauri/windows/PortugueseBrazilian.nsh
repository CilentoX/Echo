;Language: Brazilian Portuguese (1046)
;Custom language file for Tauri NSIS installer (PortugueseBrazilian)
!insertmacro LANGFILE "PortugueseBrazilian" "Brazilian Portuguese" "Português Brasileiro" "Portugues Brasileiro"

!ifdef MUI_WELCOMEPAGE
  ${LangFileString} MUI_TEXT_WELCOME_INFO_TITLE "Bem-vindo ao Instalador do $(^NameDA)"
  ${LangFileString} MUI_TEXT_WELCOME_INFO_TEXT "O instalador guiar\u00ea voc\u00ea atrav\u00e9s da instala\u00e7\u00e3o do $(^NameDA).$\r$\n$\r$\n\u00c9 recomendado que voc\u00ea feche todos os outros aplicativos antes de iniciar o instalador. Isto tornar\u00e1 poss\u00edvel atualizar os arquivos de sistema relevantes sem ter que reiniciar seu computador.$\r$\n$\r$\n$_CLICK"
!endif

!ifdef MUI_UNWELCOMEPAGE
  ${LangFileString} MUI_UNTEXT_WELCOME_INFO_TITLE "Bem-vindo ao Desinstalador do $(^NameDA)"
  ${LangFileString} MUI_UNTEXT_WELCOME_INFO_TEXT "Este assistente guiar\u00ea voc\u00ea atrav\u00e9s da desinstala\u00e7\u00e3o do $(^NameDA).$\r$\n$\r$\nAntes de iniciar a desinstala\u00e7\u00e3o tenha certeza de que o $(^NameDA) n\u00e3o est\u00e1 em execu\u00e7\u00e3o.$\r$\n$\r$\n$_CLICK"
!endif

!ifdef MUI_LICENSEPAGE
  ${LangFileString} MUI_TEXT_LICENSE_TITLE "Acordo de Licen\u00e7a"
  ${LangFileString} MUI_TEXT_LICENSE_SUBTITLE "Por favor reveja os termos da licen\u00e7a antes de instalar o $(^NameDA)."
  ${LangFileString} MUI_INNERTEXT_LICENSE_BOTTOM "Se voc\u00ea aceita os termos do acordo clique em Eu Concordo pra continuar. Voc\u00ea deve aceitar o acordo pra instalar o $(^NameDA)."
  ${LangFileString} MUI_INNERTEXT_LICENSE_BOTTOM_CHECKBOX "Se voc\u00ea aceita os termos do acordo clique na caixa de sele\u00e7\u00e3o abaixo. Voc\u00ea deve aceitar o acordo pra instalar o $(^NameDA). $_CLICK"
  ${LangFileString} MUI_INNERTEXT_LICENSE_BOTTOM_RADIOBUTTONS "Se voc\u00ea aceita os termos do acordo selecione a primeira op\u00e7\u00e3o abaixo. Voc\u00ea deve aceitar o acordo pra instalar o $(^NameDA). $_CLICK"
!endif

!ifdef MUI_UNLICENSEPAGE
  ${LangFileString} MUI_UNTEXT_LICENSE_TITLE "Acordo de Licen\u00e7a"
  ${LangFileString} MUI_UNTEXT_LICENSE_SUBTITLE "Por favor reveja os termos da licen\u00e7a antes de desinstalar o $(^NameDA)."
  ${LangFileString} MUI_UNINNERTEXT_LICENSE_BOTTOM "Se voc\u00ea aceita os termos do acordo clique em Eu Concordo pra continuar. Voc\u00ea deve aceitar o acordo pra desinstalar o $(^NameDA)."
  ${LangFileString} MUI_UNINNERTEXT_LICENSE_BOTTOM_CHECKBOX "Se voc\u00ea aceita os termos do acordo clique na caixa de sele\u00e7\u00e3o abaixo. Voc\u00ea deve aceitar o acordo pra desinstalar o $(^NameDA). $_CLICK"
  ${LangFileString} MUI_UNINNERTEXT_LICENSE_BOTTOM_RADIOBUTTONS "Se voc\u00ea aceita os termos do acordo selecione a primeira op\u00e7\u00e3o abaixo. Voc\u00ea deve aceitar o acordo pra desinstalar o $(^NameDA). $_CLICK"
!endif

!ifdef MUI_LICENSEPAGE | MUI_UNLICENSEPAGE
  ${LangFileString} MUI_INNERTEXT_LICENSE_TOP "Pressione Page Down pra ver o resto do acordo."
!endif

!ifdef MUI_COMPONENTSPAGE
  ${LangFileString} MUI_TEXT_COMPONENTS_TITLE "Escolher Componentes"
  ${LangFileString} MUI_TEXT_COMPONENTS_SUBTITLE "Escolha quais fun\u00e7\u00f5es do $(^NameDA) voc\u00ea quer instalar."
!endif

!ifdef MUI_UNCOMPONENTSPAGE
  ${LangFileString} MUI_UNTEXT_COMPONENTS_TITLE "Escolher Componentes"
  ${LangFileString} MUI_UNTEXT_COMPONENTS_SUBTITLE "Escolha quais fun\u00e7\u00f5es do $(^NameDA) voc\u00ea quer desinstalar."
!endif

!ifdef MUI_COMPONENTSPAGE | MUI_UNCOMPONENTSPAGE
  ${LangFileString} MUI_INNERTEXT_COMPONENTS_DESCRIPTION_TITLE "Descri\u00e7\u00e3o"
  !ifndef NSIS_CONFIG_COMPONENTPAGE_ALTERNATIVE
    ${LangFileString} MUI_INNERTEXT_COMPONENTS_DESCRIPTION_INFO "Posicione seu mouse sobre um componente pra ver a descri\u00e7\u00e3o dele."
  !else
    ${LangFileString} MUI_INNERTEXT_COMPONENTS_DESCRIPTION_INFO "Selecione um componente pra ver a descri\u00e7\u00e3o dele."
  !endif
!endif

!ifdef MUI_DIRECTORYPAGE
  ${LangFileString} MUI_TEXT_DIRECTORY_TITLE "Escolha o Local da Instala\u00e7\u00e3o"
  ${LangFileString} MUI_TEXT_DIRECTORY_SUBTITLE "Escolha a pasta na qual instalar o $(^NameDA)."
!endif

!ifdef MUI_UNDIRECTORYPAGE
  ${LangFileString} MUI_UNTEXT_DIRECTORY_TITLE "Escolha o Local da Desinstala\u00e7\u00e3o"
  ${LangFileString} MUI_UNTEXT_DIRECTORY_SUBTITLE "Escolha a pasta da qual desinstalar o $(^NameDA)."
!endif

!ifdef MUI_INSTFILESPAGE
  ${LangFileString} MUI_TEXT_INSTALLING_TITLE "Instalando"
  ${LangFileString} MUI_TEXT_INSTALLING_SUBTITLE "Por favor espere enquanto o $(^NameDA) est\u00e1 sendo instalado."
  ${LangFileString} MUI_TEXT_FINISH_TITLE "Instala\u00e7\u00e3o Completa"
  ${LangFileString} MUI_TEXT_FINISH_SUBTITLE "A instala\u00e7\u00e3o foi completada com sucesso."
  ${LangFileString} MUI_TEXT_ABORT_TITLE "Instala\u00e7\u00e3o Abortada"
  ${LangFileString} MUI_TEXT_ABORT_SUBTITLE "A instala\u00e7\u00e3o n\u00e3o foi completada com sucesso."
!endif

!ifdef MUI_UNINSTFILESPAGE
  ${LangFileString} MUI_UNTEXT_UNINSTALLING_TITLE "Desinstalando"
  ${LangFileString} MUI_UNTEXT_UNINSTALLING_SUBTITLE "Por favor espere enquanto o $(^NameDA) est\u00e1 sendo desinstalado."
  ${LangFileString} MUI_UNTEXT_FINISH_TITLE "Desinstala\u00e7\u00e3o Completa"
  ${LangFileString} MUI_UNTEXT_FINISH_SUBTITLE "A desinstala\u00e7\u00e3o foi completada com sucesso."
  ${LangFileString} MUI_UNTEXT_ABORT_TITLE "Desinstala\u00e7\u00e3o Abortada"
  ${LangFileString} MUI_UNTEXT_ABORT_SUBTITLE "A desinstala\u00e7\u00e3o n\u00e3o foi completada com sucesso."
!endif

!ifdef MUI_FINISHPAGE
  ${LangFileString} MUI_TEXT_FINISH_INFO_TITLE "Completando a instala\u00e7\u00e3o do $(^NameDA)"
  ${LangFileString} MUI_TEXT_FINISH_INFO_TEXT "O $(^NameDA) foi instalado no seu computador.$\r$\n$\r$\nClique em Concluir pra fechar o instalador."
  ${LangFileString} MUI_TEXT_FINISH_INFO_REBOOT "Seu computador deve ser reiniciado a fim de completar a instala\u00e7\u00e3o do $(^NameDA). Voc\u00ea quer reiniciar agora?"
!endif

!ifdef MUI_UNFINISHPAGE
  ${LangFileString} MUI_UNTEXT_FINISH_INFO_TITLE "Completando a desinstala\u00e7\u00e3o do $(^NameDA)"
  ${LangFileString} MUI_UNTEXT_FINISH_INFO_TEXT "O $(^NameDA) foi desinstalado do seu computador.$\r$\n$\r$\nClique em Concluir pra fechar o instalador."
  ${LangFileString} MUI_UNTEXT_FINISH_INFO_REBOOT "Seu computador deve ser reiniciado a fim de completar a desinstala\u00e7\u00e3o do $(^NameDA). Voc\u00ea quer reiniciar agora?"
!endif

!ifdef MUI_FINISHPAGE | MUI_UNFINISHPAGE
  ${LangFileString} MUI_TEXT_FINISH_REBOOTNOW "Reiniciar agora"
  ${LangFileString} MUI_TEXT_FINISH_REBOOTLATER "Eu quero reiniciar manualmente mais tarde"
  ${LangFileString} MUI_TEXT_FINISH_RUN "&Executar o $(^NameDA)"
  ${LangFileString} MUI_TEXT_FINISH_SHOWREADME "&Mostrar o Readme"
  ${LangFileString} MUI_BUTTONTEXT_FINISH "&Concluir"
!endif

!ifdef MUI_STARTMENUPAGE
  ${LangFileString} MUI_TEXT_STARTMENU_TITLE "Escolha a Pasta do Menu Iniciar"
  ${LangFileString} MUI_TEXT_STARTMENU_SUBTITLE "Escolha uma pasta do Menu Iniciar para os atalhos do $(^NameDA)."
  ${LangFileString} MUI_INNERTEXT_STARTMENU_TOP "Selecione a pasta do Menu Iniciar na qual voc\u00ea gostaria de criar os atalhos do programa. Voc\u00ea pode tamb\u00e9m inserir um nome pra criar uma nova pasta."
  ${LangFileString} MUI_INNERTEXT_STARTMENU_CHECKBOX "N\u00e3o criar atalhos"
!endif

!ifdef MUI_UNCONFIRMPAGE
  ${LangFileString} MUI_UNTEXT_CONFIRM_TITLE "Desinstalar o $(^NameDA)"
  ${LangFileString} MUI_UNTEXT_CONFIRM_SUBTITLE "Remover o $(^NameDA) do seu computador."
!endif

!ifdef MUI_ABORTWARNING
  ${LangFileString} MUI_TEXT_ABORTWARNING "Voc\u00ea tem certeza que voc\u00ea quer sair da Instala\u00e7\u00e3o do $(^Name)?"
!endif

!ifdef MUI_UNABORTWARNING
  ${LangFileString} MUI_UNTEXT_ABORTWARNING "Voc\u00ea tem certeza que voc\u00ea quer sair da Desinstala\u00e7\u00e3o do $(^Name)?"
!endif

!ifdef MULTIUSER_INSTALLMODEPAGE
  ${LangFileString} MULTIUSER_TEXT_INSTALLMODE_TITLE "Escolher Usu\u00e1rios"
  ${LangFileString} MULTIUSER_TEXT_INSTALLMODE_SUBTITLE "Escolha pra quais usu\u00e1rios voc\u00ea quer instalar o $(^NameDA)."
  ${LangFileString} MULTIUSER_INNERTEXT_INSTALLMODE_TOP "Selecione se voc\u00ea quer instalar o $(^NameDA) s\u00f3 pra si mesmo ou pra todos os usu\u00e1rios deste computador. $(^ClickNext)"
  ${LangFileString} MULTIUSER_INNERTEXT_INSTALLMODE_ALLUSERS "Instalar pra qualquer um usando este computador"
  ${LangFileString} MULTIUSER_INNERTEXT_INSTALLMODE_CURRENTUSER "Instalar apenas pra mim"
!endif
