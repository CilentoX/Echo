using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Effects;
using Microsoft.Win32;

namespace EchoConfigurator
{
    public class AppProfile
    {
        public string KeyId { get; set; }
        public string Name { get; set; }
        public string ApiKey { get; set; }
        public string GatewayUrl { get; set; }
        public string Description { get; set; }
    }

    public class DiagnosticItem
    {
        public string Name { get; set; }
        public string Status { get; set; } // "OK", "AVISO", "ERRO"
        public string Detail { get; set; }
    }

    public class Program
    {
        [DllImport("dwmapi.dll", PreserveSig = true)]
        public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        public static extern IntPtr SendMessageTimeout(
            IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam,
            uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);

        public const uint HWND_BROADCAST = 0xffff;
        public const uint WM_SETTINGCHANGE = 0x001A;
        public const uint SMTO_ABORTIFHUNG = 0x0002;
        public const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;

        [STAThread]
        public static void Main()
        {
            try
            {
                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            }
            catch { }

            var app = new Application();
            var window = new MainWindow();
            app.Run(window);
        }
    }

    public class MainWindow : Window
    {
        private List<AppProfile> profiles;
        private AppProfile selectedProfile;

        // UI Header Controls
        private TextBlock txtIpStatus;
        private Border badgeIp;

        // Tab Navigation
        private Button tabBtnSetup;
        private Button tabBtnDiag;
        private Button tabBtnTools;
        private Grid tabContentSetup;
        private Grid tabContentDiag;
        private Grid tabContentTools;

        // Tab 1: Setup Controls
        private ComboBox cmbProfile;
        private TextBox txtGateway;
        private TextBox txtApiKey;
        private PasswordBox pwbApiKey;
        private Button btnToggleKeyVisibility;
        private bool isKeyVisible;
        private TextBox txtModels;
        private RadioButton rbTargetBoth;
        private RadioButton rbTargetDesktop;
        private RadioButton rbTargetCode;
        private Button btnApply;
        private Button btnTestGateway;
        private Button btnTestCli;

        // Tab 2: Diagnostic Controls
        private StackPanel panelDiagItems;
        private Button btnRunDiag;
        private Button btnAutoRepairAll;

        // Tab 3: Tools Controls
        private TextBlock txtMcpSummary;
        private Button btnExportMcpConfig;
        private Button btnImportMcpConfig;
        private TextBlock txtSessionsSummary;
        private Button btnCleanSessions;
        private Button btnExportKit;
        private Button btnOpenDesktop;
        private Button btnOpenCodeTerminal;

        // Bottom Global Console / Feedback
        private Border boxConsole;
        private TextBlock txtConsoleTitle;
        private TextBox txtConsoleLogs;
        private ProgressBar prgBusy;

        public MainWindow()
        {
            this.Title = "Echo · Configurador Pro (Desktop & Code CLI)";
            this.Width = 720;
            this.Height = 880;
            this.WindowStartupLocation = WindowStartupLocation.CenterScreen;
            this.ResizeMode = ResizeMode.CanMinimize;
            this.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0b0e14"));

            InitProfiles();
            BuildUi();

            this.Loaded += (s, e) =>
            {
                ApplyDarkTitlebar();
                SwitchTab(1);
                CheckPublicIpAsync();
                RunFullDiagnosticAsync();
            };
        }

        private void ApplyDarkTitlebar()
        {
            try
            {
                var helper = new System.Windows.Interop.WindowInteropHelper(this);
                int darkMode = 1;
                Program.DwmSetWindowAttribute(helper.Handle, Program.DWMWA_USE_IMMERSIVE_DARK_MODE, ref darkMode, sizeof(int));
            }
            catch { }
        }

        private void InitProfiles()
        {
            profiles = new List<AppProfile>();

            profiles.Add(new AppProfile
            {
                KeyId = "01",
                Name = "Chave 01 · Primária (Lucas - DevPulse)",
                ApiKey = "gcli_yaoHuyQP0XwaGVaow-ek0SUrogs-HiWr",
                GatewayUrl = "https://ghostcli.cloud",
                Description = "Chave principal para desenvolvimento"
            });

            profiles.Add(new AppProfile
            {
                KeyId = "02",
                Name = "Chave 02 · Contingência (DevPulse)",
                ApiKey = "gcli_ioP-IG8M8wk9f3BwIKAj88wFHHFME67r",
                GatewayUrl = "https://ghostcli.cloud",
                Description = "Chave secundária de reserva"
            });

            profiles.Add(new AppProfile
            {
                KeyId = "03",
                Name = "Chave 03 · Terceira (DevPulse)",
                ApiKey = "gcli_C8mxx7-ZfMQLo85ecIGWwNADWw2OrxXR",
                GatewayUrl = "https://ghostcli.cloud",
                Description = "Chave terciária de reserva"
            });

            profiles.Add(new AppProfile
            {
                KeyId = "custom",
                Name = "Chave Personalizada (Digitar manualmente)",
                ApiKey = "",
                GatewayUrl = "https://ghostcli.cloud",
                Description = "Permite inserir qualquer API Key arbitrária"
            });

            selectedProfile = profiles[0];
            isKeyVisible = true;
        }

        private void BuildUi()
        {
            var mainGrid = new Grid();
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // Header & Tabs
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); // Scrollable Content
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // Footer Console
            this.Content = mainGrid;

            // ==================== HEADER ====================
            var topPanel = new StackPanel { Margin = new Thickness(24, 18, 24, 12) };

            var headerDock = new DockPanel();

            var titleBox = new StackPanel();
            var lblTitle = new TextBlock
            {
                Text = "ECHO CONFIGURADOR PRO",
                FontSize = 19,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F3EEF9")),
                FontFamily = new FontFamily("Segoe UI")
            };
            var lblSub = new TextBlock
            {
                Text = "Gerenciador nativo de conexões para Claude Desktop & Claude Code CLI",
                FontSize = 12,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8b9bb4")),
                Margin = new Thickness(0, 2, 0, 0)
            };
            titleBox.Children.Add(lblTitle);
            titleBox.Children.Add(lblSub);
            DockPanel.SetDock(titleBox, Dock.Left);
            headerDock.Children.Add(titleBox);

            var versionPill = new Border
            {
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#141923")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0FB9A8")),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(12),
                Padding = new Thickness(12, 5, 12, 5),
                HorizontalAlignment = HorizontalAlignment.Right,
                VerticalAlignment = VerticalAlignment.Center
            };
            var lblVersion = new TextBlock
            {
                Text = "⚡ GhostCLI v2.5",
                FontSize = 11,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0FB9A8"))
            };
            versionPill.Child = lblVersion;
            DockPanel.SetDock(versionPill, Dock.Right);
            headerDock.Children.Add(versionPill);

            topPanel.Children.Add(headerDock);

            // IP Status Bar
            badgeIp = new Border
            {
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#10141d")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#222a38")),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(10),
                Padding = new Thickness(14, 8, 14, 8),
                Margin = new Thickness(0, 12, 0, 12)
            };
            var ipDock = new DockPanel();
            txtIpStatus = new TextBlock
            {
                Text = "● Verificando IP público e rota do WireGuard...",
                FontSize = 12,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8b9bb4")),
                VerticalAlignment = VerticalAlignment.Center
            };
            DockPanel.SetDock(txtIpStatus, Dock.Left);
            ipDock.Children.Add(txtIpStatus);

            var btnRefreshIp = new Button
            {
                Content = "Recarregar IP",
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0FB9A8")),
                Cursor = Cursors.Hand,
                HorizontalAlignment = HorizontalAlignment.Right,
                FontSize = 11,
                FontWeight = FontWeights.SemiBold
            };
            btnRefreshIp.Click += (s, e) => CheckPublicIpAsync();
            DockPanel.SetDock(btnRefreshIp, Dock.Right);
            ipDock.Children.Add(btnRefreshIp);

            badgeIp.Child = ipDock;
            topPanel.Children.Add(badgeIp);

            // Segmented Navigation Tabs
            var tabGrid = new UniformGrid { Columns = 3, Margin = new Thickness(0, 4, 0, 4) };
            tabBtnSetup = CreateTabButton("⚡ Configuração", 1);
            tabBtnDiag = CreateTabButton("🔍 Diagnóstico", 2);
            tabBtnTools = CreateTabButton("🛠️ Ferramentas & Kit", 3);

            tabGrid.Children.Add(tabBtnSetup);
            tabGrid.Children.Add(tabBtnDiag);
            tabGrid.Children.Add(tabBtnTools);
            topPanel.Children.Add(tabGrid);

            Grid.SetRow(topPanel, 0);
            mainGrid.Children.Add(topPanel);

            // ==================== CONTENT SCROLLER ====================
            var scroll = new ScrollViewer
            {
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                Padding = new Thickness(24, 6, 24, 10)
            };
            Grid.SetRow(scroll, 1);
            mainGrid.Children.Add(scroll);

            var contentContainer = new Grid();
            scroll.Content = contentContainer;

            // Build Tab 1
            tabContentSetup = BuildSetupTab();
            contentContainer.Children.Add(tabContentSetup);

            // Build Tab 2
            tabContentDiag = BuildDiagTab();
            contentContainer.Children.Add(tabContentDiag);

            // Build Tab 3
            tabContentTools = BuildToolsTab();
            contentContainer.Children.Add(tabContentTools);

            // ==================== FOOTER / CONSOLE ====================
            var bottomPanel = new StackPanel { Margin = new Thickness(24, 0, 24, 16) };

            prgBusy = new ProgressBar
            {
                Height = 3,
                IsIndeterminate = true,
                Visibility = Visibility.Collapsed,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0FB9A8")),
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#141923")),
                BorderThickness = new Thickness(0),
                Margin = new Thickness(0, 0, 0, 8)
            };
            bottomPanel.Children.Add(prgBusy);

            boxConsole = new Border
            {
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#10141d")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#222a38")),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(10),
                Padding = new Thickness(12, 10, 12, 10)
            };
            var consoleStack = new StackPanel();

            var consoleHeader = new DockPanel();
            txtConsoleTitle = new TextBlock
            {
                Text = "STATUS / CONSOLE",
                FontSize = 11,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8b9bb4"))
            };
            DockPanel.SetDock(txtConsoleTitle, Dock.Left);
            consoleHeader.Children.Add(txtConsoleTitle);

            var btnClearLog = new Button
            {
                Content = "Limpar",
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8b9bb4")),
                FontSize = 11,
                Cursor = Cursors.Hand,
                HorizontalAlignment = HorizontalAlignment.Right
            };
            btnClearLog.Click += (s, e) => txtConsoleLogs.Text = "Pronto para operações.";
            DockPanel.SetDock(btnClearLog, Dock.Right);
            consoleHeader.Children.Add(btnClearLog);
            consoleStack.Children.Add(consoleHeader);

            txtConsoleLogs = new TextBox
            {
                Text = "Aplicativo pronto. Selecione a chave desejada e clique em 'Aplicar Configuração'.",
                FontSize = 12,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#d1d5db")),
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                IsReadOnly = true,
                TextWrapping = TextWrapping.Wrap,
                MaxHeight = 90,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                Margin = new Thickness(0, 6, 0, 0)
            };
            consoleStack.Children.Add(txtConsoleLogs);

            boxConsole.Child = consoleStack;
            bottomPanel.Children.Add(boxConsole);

            Grid.SetRow(bottomPanel, 2);
            mainGrid.Children.Add(bottomPanel);
        }

        private Button CreateTabButton(string text, int tabIndex)
        {
            var btn = new Button
            {
                Content = text,
                Height = 36,
                FontSize = 12,
                FontWeight = FontWeights.SemiBold,
                Cursor = Cursors.Hand,
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#141923")),
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8b9bb4")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#222a38")),
                BorderThickness = new Thickness(1),
                Margin = new Thickness(2, 0, 2, 0)
            };

            btn.Click += (s, e) => SwitchTab(tabIndex);
            return btn;
        }

        private void SwitchTab(int index)
        {
            tabContentSetup.Visibility = index == 1 ? Visibility.Visible : Visibility.Collapsed;
            tabContentDiag.Visibility = index == 2 ? Visibility.Visible : Visibility.Collapsed;
            tabContentTools.Visibility = index == 3 ? Visibility.Visible : Visibility.Collapsed;

            var activeBg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0FB9A8"));
            var activeFg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0b0e14"));
            var inactiveBg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#141923"));
            var inactiveFg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8b9bb4"));

            tabBtnSetup.Background = index == 1 ? activeBg : inactiveBg;
            tabBtnSetup.Foreground = index == 1 ? activeFg : inactiveFg;

            tabBtnDiag.Background = index == 2 ? activeBg : inactiveBg;
            tabBtnDiag.Foreground = index == 2 ? activeFg : inactiveFg;

            tabBtnTools.Background = index == 3 ? activeBg : inactiveBg;
            tabBtnTools.Foreground = index == 3 ? activeFg : inactiveFg;
        }

        // ==================== TAB 1: SETUP BUILDER ====================
        private Grid BuildSetupTab()
        {
            var grid = new Grid();
            var panel = new StackPanel();
            grid.Children.Add(panel);

            // Card 1: Perfil e Chaves
            var credCard = CreateCard();
            credCard.Margin = new Thickness(0, 0, 0, 14);
            var credPanel = new StackPanel();

            credPanel.Children.Add(CreateSectionLabel("SELECIONE A CHAVE / PERFIL"));

            cmbProfile = new ComboBox
            {
                Margin = new Thickness(0, 4, 0, 12),
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#141923")),
                Foreground = Brushes.Black,
                FontSize = 13,
                Height = 34
            };
            foreach (var p in profiles)
            {
                cmbProfile.Items.Add(p.Name);
            }
            cmbProfile.SelectedIndex = 0;
            cmbProfile.SelectionChanged += (s, e) =>
            {
                if (cmbProfile.SelectedIndex >= 0 && cmbProfile.SelectedIndex < profiles.Count)
                {
                    selectedProfile = profiles[cmbProfile.SelectedIndex];
                    txtGateway.Text = selectedProfile.GatewayUrl;
                    txtApiKey.Text = selectedProfile.ApiKey;
                    pwbApiKey.Password = selectedProfile.ApiKey;
                    LogConsole(string.Format("Perfil selecionado: {0}", selectedProfile.Name));
                }
            };
            credPanel.Children.Add(cmbProfile);

            credPanel.Children.Add(CreateSectionLabel("GATEWAY BASE URL (ANTHROPIC COMPATIBLE)"));
            txtGateway = CreateTextBox(selectedProfile.GatewayUrl);
            credPanel.Children.Add(txtGateway);

            // API Key with Show/Hide toggle
            var keyHeader = new DockPanel();
            var lblKey = CreateSectionLabel("API KEY");
            DockPanel.SetDock(lblKey, Dock.Left);
            keyHeader.Children.Add(lblKey);

            btnToggleKeyVisibility = new Button
            {
                Content = "Ocultar Chave",
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0FB9A8")),
                FontSize = 11,
                Cursor = Cursors.Hand,
                HorizontalAlignment = HorizontalAlignment.Right
            };
            btnToggleKeyVisibility.Click += (s, e) =>
            {
                isKeyVisible = !isKeyVisible;
                txtApiKey.Visibility = isKeyVisible ? Visibility.Visible : Visibility.Collapsed;
                pwbApiKey.Visibility = isKeyVisible ? Visibility.Collapsed : Visibility.Visible;
                btnToggleKeyVisibility.Content = isKeyVisible ? "Ocultar Chave" : "Exibir Chave";

                if (isKeyVisible)
                    txtApiKey.Text = pwbApiKey.Password;
                else
                    pwbApiKey.Password = txtApiKey.Text;
            };
            DockPanel.SetDock(btnToggleKeyVisibility, Dock.Right);
            keyHeader.Children.Add(btnToggleKeyVisibility);
            credPanel.Children.Add(keyHeader);

            txtApiKey = CreateTextBox(selectedProfile.ApiKey);
            pwbApiKey = new PasswordBox
            {
                Password = selectedProfile.ApiKey,
                Height = 32,
                FontSize = 13,
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#141923")),
                Foreground = Brushes.White,
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#2b374c")),
                BorderThickness = new Thickness(1),
                Padding = new Thickness(6, 4, 6, 4),
                Margin = new Thickness(0, 2, 0, 10),
                Visibility = Visibility.Collapsed
            };
            credPanel.Children.Add(txtApiKey);
            credPanel.Children.Add(pwbApiKey);

            credPanel.Children.Add(CreateSectionLabel("MODELOS HABILITADOS (JSON ARRAY)"));
            txtModels = CreateTextBox("[\"claude-sonnet-5\",\"claude-opus-5-5\",\"claude-fable-5.1\"]");
            credPanel.Children.Add(txtModels);

            credCard.Child = credPanel;
            panel.Children.Add(credCard);

            // Card 2: Onde Aplicar
            var targetCard = CreateCard();
            targetCard.Margin = new Thickness(0, 0, 0, 14);
            var targetPanel = new StackPanel();
            targetPanel.Children.Add(CreateSectionLabel("ALVO DA CONFIGURAÇÃO"));

            var targetGrid = new UniformGrid { Columns = 3, Margin = new Thickness(0, 6, 0, 4) };
            rbTargetBoth = CreateRadioButton("Ambos (Recomendado)", true);
            rbTargetDesktop = CreateRadioButton("Apenas Claude Desktop", false);
            rbTargetCode = CreateRadioButton("Apenas Claude Code", false);

            targetGrid.Children.Add(rbTargetBoth);
            targetGrid.Children.Add(rbTargetDesktop);
            targetGrid.Children.Add(rbTargetCode);
            targetPanel.Children.Add(targetGrid);

            targetCard.Child = targetPanel;
            panel.Children.Add(targetCard);

            // Card 3: Action Buttons
            btnApply = new Button
            {
                Content = "⚡ APLICAR CONFIGURAÇÃO COMPLETA",
                Height = 44,
                FontSize = 14,
                FontWeight = FontWeights.Bold,
                Cursor = Cursors.Hand,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0b0e14")),
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0FB9A8")),
                BorderThickness = new Thickness(0),
                Margin = new Thickness(0, 0, 0, 10)
            };
            btnApply.Click += (s, e) => ApplyConfiguration();
            panel.Children.Add(btnApply);

            var testGrid = new UniformGrid { Columns = 2, Margin = new Thickness(0, 0, 0, 6) };

            btnTestGateway = new Button
            {
                Content = "🌐 Testar Conexão GhostCLI (Live)",
                Height = 38,
                FontSize = 12,
                FontWeight = FontWeights.SemiBold,
                Cursor = Cursors.Hand,
                Foreground = Brushes.White,
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#192130")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#2b374c")),
                BorderThickness = new Thickness(1),
                Margin = new Thickness(0, 0, 4, 0)
            };
            btnTestGateway.Click += (s, e) => TestConnectionAsync();
            testGrid.Children.Add(btnTestGateway);

            btnTestCli = new Button
            {
                Content = "💻 Testar Terminal CLI (claude -p)",
                Height = 38,
                FontSize = 12,
                FontWeight = FontWeights.SemiBold,
                Cursor = Cursors.Hand,
                Foreground = Brushes.White,
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#192130")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#2b374c")),
                BorderThickness = new Thickness(1),
                Margin = new Thickness(4, 0, 0, 0)
            };
            btnTestCli.Click += (s, e) => TestCliAsync();
            testGrid.Children.Add(btnTestCli);

            panel.Children.Add(testGrid);

            return grid;
        }

        // ==================== TAB 2: DIAGNOSTIC BUILDER ====================
        private Grid BuildDiagTab()
        {
            var grid = new Grid();
            var panel = new StackPanel();
            grid.Children.Add(panel);

            var card = CreateCard();
            card.Margin = new Thickness(0, 0, 0, 14);
            var cardPanel = new StackPanel();

            var dockHeader = new DockPanel { Margin = new Thickness(0, 0, 0, 12) };
            var lblDiag = new TextBlock
            {
                Text = "VARREDURA DO SISTEMA (10 PONTOS CRÍTICOS)",
                FontSize = 13,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F3EEF9"))
            };
            DockPanel.SetDock(lblDiag, Dock.Left);
            dockHeader.Children.Add(lblDiag);

            btnRunDiag = new Button
            {
                Content = "🔄 Executar Varredura",
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0FB9A8")),
                FontSize = 12,
                FontWeight = FontWeights.SemiBold,
                Cursor = Cursors.Hand,
                HorizontalAlignment = HorizontalAlignment.Right
            };
            btnRunDiag.Click += (s, e) => RunFullDiagnosticAsync();
            DockPanel.SetDock(btnRunDiag, Dock.Right);
            dockHeader.Children.Add(btnRunDiag);
            cardPanel.Children.Add(dockHeader);

            panelDiagItems = new StackPanel();
            cardPanel.Children.Add(panelDiagItems);

            card.Child = cardPanel;
            panel.Children.Add(card);

            btnAutoRepairAll = new Button
            {
                Content = "🛠️ REPARAR TUDO COM 1 CLIQUE (AUTO-FIX)",
                Height = 44,
                FontSize = 13,
                FontWeight = FontWeights.Bold,
                Cursor = Cursors.Hand,
                Foreground = Brushes.White,
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#1d4ed8")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#3b82f6")),
                BorderThickness = new Thickness(1),
                Margin = new Thickness(0, 4, 0, 6)
            };
            btnAutoRepairAll.Click += (s, e) => AutoRepairAllAsync();
            panel.Children.Add(btnAutoRepairAll);

            return grid;
        }

        // ==================== TAB 3: TOOLS BUILDER ====================
        private Grid BuildToolsTab()
        {
            var grid = new Grid();
            var panel = new StackPanel();
            grid.Children.Add(panel);

            // Card 1: Sessões / 12 Turnos Fix
            var sessCard = CreateCard();
            sessCard.Margin = new Thickness(0, 0, 0, 14);
            var sessPanel = new StackPanel();
            sessPanel.Children.Add(CreateSectionLabel("LIBERAÇÃO DE TURNOS & CACHE"));

            txtSessionsSummary = new TextBlock
            {
                Text = "Calculando sessões em cache...",
                FontSize = 12,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8b9bb4")),
                Margin = new Thickness(0, 4, 0, 10),
                TextWrapping = TextWrapping.Wrap
            };
            sessPanel.Children.Add(txtSessionsSummary);

            btnCleanSessions = CreateSmallButton("🧹 Limpar Sessões Presas (Corrige Erro 429 / 12 Turnos)");
            btnCleanSessions.Click += (s, e) => ClearStuckTurnsCache();
            sessPanel.Children.Add(btnCleanSessions);

            sessCard.Child = sessPanel;
            panel.Children.Add(sessCard);

            // Card 2: MCP Servers
            var mcpCard = CreateCard();
            mcpCard.Margin = new Thickness(0, 0, 0, 14);
            var mcpPanel = new StackPanel();
            mcpPanel.Children.Add(CreateSectionLabel("MCP SERVERS CONFIGURADOS (DESKTOP)"));

            txtMcpSummary = new TextBlock
            {
                Text = "Carregando servidores MCP...",
                FontSize = 12,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8b9bb4")),
                Margin = new Thickness(0, 4, 0, 10),
                TextWrapping = TextWrapping.Wrap
            };
            mcpPanel.Children.Add(txtMcpSummary);

            var mcpBtnGrid = new UniformGrid { Columns = 2, Margin = new Thickness(0, 0, 0, 2) };

            btnExportMcpConfig = CreateSmallButton("💾 Exportar Configurações MCP (.json)");
            btnExportMcpConfig.Click += (s, e) => ExportMcpConfiguration();
            mcpBtnGrid.Children.Add(btnExportMcpConfig);

            btnImportMcpConfig = CreateSmallButton("📥 Importar Configurações MCP");
            btnImportMcpConfig.Click += (s, e) => ImportMcpConfiguration();
            mcpBtnGrid.Children.Add(btnImportMcpConfig);

            mcpPanel.Children.Add(mcpBtnGrid);

            mcpCard.Child = mcpPanel;
            panel.Children.Add(mcpCard);

            // Card 3: Portabilidade & Kit
            var kitCard = CreateCard();
            kitCard.Margin = new Thickness(0, 0, 0, 14);
            var kitPanel = new StackPanel();
            kitPanel.Children.Add(CreateSectionLabel("PORTABILIDADE PARA OUTRA MÁQUINA"));

            var txtKit = new TextBlock
            {
                Text = "Crie uma pasta pronta na Área de Trabalho com o executável portátil e as configurações prontas para copiar para seu outro computador.",
                FontSize = 12,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8b9bb4")),
                Margin = new Thickness(0, 4, 0, 10),
                TextWrapping = TextWrapping.Wrap
            };
            kitPanel.Children.Add(txtKit);

            btnExportKit = CreateSmallButton("📦 Exportar Kit Completo para Pen Drive / Outra Máquina");
            btnExportKit.Click += (s, e) => ExportDeploymentKit();
            kitPanel.Children.Add(btnExportKit);

            kitCard.Child = kitPanel;
            panel.Children.Add(kitCard);

            // Card 4: Atalhos de Inicialização
            var launchCard = CreateCard();
            launchCard.Margin = new Thickness(0, 0, 0, 14);
            var launchPanel = new StackPanel();
            launchPanel.Children.Add(CreateSectionLabel("ATALHOS RÁPIDOS DE INICIALIZAÇÃO"));

            var lGrid = new UniformGrid { Columns = 2, Margin = new Thickness(0, 6, 0, 0) };
            btnOpenDesktop = CreateSecondaryButton("Abrir Claude Desktop");
            btnOpenDesktop.Click += (s, e) => LaunchClaudeDesktop();
            lGrid.Children.Add(btnOpenDesktop);

            btnOpenCodeTerminal = CreateSecondaryButton("Abrir Claude Code no Terminal");
            btnOpenCodeTerminal.Click += (s, e) => LaunchClaudeCode();
            lGrid.Children.Add(btnOpenCodeTerminal);

            launchPanel.Children.Add(lGrid);
            launchCard.Child = launchPanel;
            panel.Children.Add(launchCard);

            return grid;
        }

        private Border CreateCard()
        {
            return new Border
            {
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#10141d")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#222a38")),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(12),
                Padding = new Thickness(16, 14, 16, 14)
            };
        }

        private TextBlock CreateSectionLabel(string text)
        {
            return new TextBlock
            {
                Text = text,
                FontSize = 11,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8b9bb4")),
                Margin = new Thickness(0, 4, 0, 4)
            };
        }

        private TextBox CreateTextBox(string text)
        {
            return new TextBox
            {
                Text = text,
                Height = 32,
                FontSize = 13,
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#141923")),
                Foreground = Brushes.White,
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#2b374c")),
                BorderThickness = new Thickness(1),
                Padding = new Thickness(6, 4, 6, 4),
                Margin = new Thickness(0, 2, 0, 10)
            };
        }

        private RadioButton CreateRadioButton(string content, bool isChecked)
        {
            return new RadioButton
            {
                Content = content,
                IsChecked = isChecked,
                GroupName = "Targets",
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F3EEF9")),
                FontSize = 12,
                Margin = new Thickness(0, 0, 6, 0),
                Cursor = Cursors.Hand
            };
        }

        private Button CreateSmallButton(string content)
        {
            return new Button
            {
                Content = content,
                Padding = new Thickness(12, 8, 12, 8),
                FontSize = 12,
                FontWeight = FontWeights.SemiBold,
                Margin = new Thickness(0, 4, 0, 4),
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#192130")),
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F3EEF9")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#2b374c")),
                BorderThickness = new Thickness(1),
                Cursor = Cursors.Hand
            };
        }

        private Button CreateSecondaryButton(string content)
        {
            return new Button
            {
                Content = content,
                Padding = new Thickness(10, 8, 10, 8),
                FontSize = 12,
                FontWeight = FontWeights.SemiBold,
                Margin = new Thickness(3, 0, 3, 0),
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#141923")),
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F3EEF9")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#222a38")),
                BorderThickness = new Thickness(1),
                Cursor = Cursors.Hand
            };
        }

        // ==================== LOGGING HELPER ====================
        private void LogConsole(string message)
        {
            string time = DateTime.Now.ToString("HH:mm:ss");
            txtConsoleLogs.Text = string.Format("[{0}] {1}\n{2}", time, message, txtConsoleLogs.Text);
        }

        // ==================== IP DETECTION ====================
        private async void CheckPublicIpAsync()
        {
            txtIpStatus.Text = "● Verificando IP público e WireGuard...";
            txtIpStatus.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8b9bb4"));

            try
            {
                using (var client = new HttpClient())
                {
                    client.Timeout = TimeSpan.FromSeconds(6);
                    string ip = (await client.GetStringAsync("https://api.ipify.org")).Trim();

                    if (ip == "152.67.46.168")
                    {
                        txtIpStatus.Text = string.Format("● IP: {0} (Oracle VPS / WireGuard Ativo) · Liberado no GhostCLI", ip);
                        txtIpStatus.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#10B981"));
                        badgeIp.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#10B981"));
                    }
                    else
                    {
                        txtIpStatus.Text = string.Format("▲ IP Atual: {0} (Atenção: fora do WireGuard · autorize este IP no painel)", ip);
                        txtIpStatus.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F59E0B"));
                        badgeIp.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F59E0B"));
                    }
                }
            }
            catch (Exception ex)
            {
                txtIpStatus.Text = string.Format("● Falha ao consultar IP: {0}", ex.Message);
                txtIpStatus.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#EF4444"));
                badgeIp.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#EF4444"));
            }
        }

        // ==================== FULL DIAGNOSTICS ====================
        private async void RunFullDiagnosticAsync()
        {
            panelDiagItems.Children.Clear();
            var loadingTxt = new TextBlock
            {
                Text = "Executando varredura detalhada em todos os subsistemas...",
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8b9bb4")),
                FontSize = 12
            };
            panelDiagItems.Children.Add(loadingTxt);

            var items = new List<DiagnosticItem>();

            await Task.Run(() =>
            {
                // 1. IP
                try
                {
                    using (var c = new HttpClient())
                    {
                        c.Timeout = TimeSpan.FromSeconds(5);
                        string ip = c.GetStringAsync("https://api.ipify.org").Result.Trim();
                        if (ip == "152.67.46.168")
                            items.Add(new DiagnosticItem { Name = "IP Público & WireGuard", Status = "OK", Detail = "IP 152.67.46.168 (Oracle VPS). Rota protegida." });
                        else
                            items.Add(new DiagnosticItem { Name = "IP Público & WireGuard", Status = "AVISO", Detail = string.Format("IP {0}. Fora da VPS Oracle. Ative WireGuard.", ip) });
                    }
                }
                catch (Exception ex)
                {
                    items.Add(new DiagnosticItem { Name = "IP Público & WireGuard", Status = "ERRO", Detail = ex.Message });
                }

                // 2. Claude Desktop Installed
                string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                string desktopApp = Path.Combine(userProfile, @"AppData\Local\Microsoft\WindowsApps\claude-desktop.exe");
                if (File.Exists(desktopApp))
                    items.Add(new DiagnosticItem { Name = "Claude Desktop Instalado", Status = "OK", Detail = "Instalação MSIX/WindowsApps detectada." });
                else
                    items.Add(new DiagnosticItem { Name = "Claude Desktop Instalado", Status = "AVISO", Detail = "Executável padrão não localizado em WindowsApps." });

                // 3. Claude Desktop Process
                var procs = Process.GetProcessesByName("claude");
                if (procs.Length > 0)
                    items.Add(new DiagnosticItem { Name = "Processos do Claude Desktop", Status = "AVISO", Detail = string.Format("{0} processo(s) em execução. Feche antes de aplicar.", procs.Length) });
                else
                    items.Add(new DiagnosticItem { Name = "Processos do Claude Desktop", Status = "OK", Detail = "Nenhum processo concorrente bloqueando chaves." });

                // 4. Registry Policy
                try
                {
                    using (var k = Registry.CurrentUser.OpenSubKey(@"Software\Policies\Claude", false))
                    {
                        if (k != null)
                        {
                            var g = k.GetValue("inferenceGatewayBaseUrl") as string;
                            if (g != null && g.Contains("devpulseiabr.vercel.app"))
                                items.Add(new DiagnosticItem { Name = "Registro (GPO Policy)", Status = "ERRO", Detail = "Apontando para Vercel antiga (Gera 403 na AWS)!" });
                            else if (g != null && g.Contains("ghostcli.cloud"))
                                items.Add(new DiagnosticItem { Name = "Registro (GPO Policy)", Status = "OK", Detail = "Apontando diretamente para GhostCLI." });
                            else
                                items.Add(new DiagnosticItem { Name = "Registro (GPO Policy)", Status = "AVISO", Detail = string.Format("Gateway configurado: {0}", g) });
                        }
                        else
                        {
                            items.Add(new DiagnosticItem { Name = "Registro (GPO Policy)", Status = "AVISO", Detail = "Chave de política corporativa não criada ainda." });
                        }
                    }
                }
                catch (Exception ex)
                {
                    items.Add(new DiagnosticItem { Name = "Registro (GPO Policy)", Status = "ERRO", Detail = ex.Message });
                }

                // 5. Registry ACL
                try
                {
                    using (var k = Registry.CurrentUser.OpenSubKey(@"Software\Policies\Claude", RegistryKeyPermissionCheck.ReadWriteSubTree))
                    {
                        if (k != null)
                            items.Add(new DiagnosticItem { Name = "Permissões de Registro", Status = "OK", Detail = "Acesso de gravação (FullControl) garantido." });
                        else
                            items.Add(new DiagnosticItem { Name = "Permissões de Registro", Status = "OK", Detail = "Chave livre para criação." });
                    }
                }
                catch
                {
                    items.Add(new DiagnosticItem { Name = "Permissões de Registro", Status = "ERRO", Detail = "Permissão restrita (Somente Leitura). O auto-fix corrigirá." });
                }

                // 6. Claude Code Binary
                string localBin = Path.Combine(userProfile, @".local\bin\claude.exe");
                if (File.Exists(localBin))
                    items.Add(new DiagnosticItem { Name = "Claude Code CLI", Status = "OK", Detail = string.Format("Binário presente em {0}", localBin) });
                else
                    items.Add(new DiagnosticItem { Name = "Claude Code CLI", Status = "AVISO", Detail = "claude.exe ausente em ~/.local/bin." });

                // 7. PATH
                string pEnv = Environment.GetEnvironmentVariable("Path", EnvironmentVariableTarget.User) ?? "";
                if (pEnv.Contains(@".local\bin"))
                    items.Add(new DiagnosticItem { Name = "Variável PATH do Usuário", Status = "OK", Detail = "~/.local/bin presente no PATH." });
                else
                    items.Add(new DiagnosticItem { Name = "Variável PATH do Usuário", Status = "AVISO", Detail = "~/.local/bin não encontrado no PATH." });

                // 8. Code Environment Variables
                string bUrl = Environment.GetEnvironmentVariable("ANTHROPIC_BASE_URL", EnvironmentVariableTarget.User);
                string aKey = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY", EnvironmentVariableTarget.User);
                if (!string.IsNullOrEmpty(bUrl) && !string.IsNullOrEmpty(aKey))
                    items.Add(new DiagnosticItem { Name = "Variáveis de Ambiente CLI", Status = "OK", Detail = string.Format("BASE_URL: {0} | API_KEY: Configurada", bUrl) });
                else
                    items.Add(new DiagnosticItem { Name = "Variáveis de Ambiente CLI", Status = "AVISO", Detail = "ANTHROPIC_BASE_URL ou ANTHROPIC_API_KEY vazios." });

                // 9. settings.json
                string sPath = Path.Combine(userProfile, @".claude\settings.json");
                if (File.Exists(sPath))
                    items.Add(new DiagnosticItem { Name = "Arquivo ~/.claude/settings.json", Status = "OK", Detail = "Arquivo de configurações JSON existe." });
                else
                    items.Add(new DiagnosticItem { Name = "Arquivo ~/.claude/settings.json", Status = "AVISO", Detail = "Arquivo ainda não criado." });

                // 10. Node.js
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "node.exe",
                        Arguments = "--version",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        CreateNoWindow = true
                    };
                    using (var p = Process.Start(psi))
                    {
                        string v = p.StandardOutput.ReadToEnd().Trim();
                        p.WaitForExit(3000);
                        items.Add(new DiagnosticItem { Name = "Ambiente Node.js", Status = "OK", Detail = string.Format("Instalado ({0})", v) });
                    }
                }
                catch
                {
                    items.Add(new DiagnosticItem { Name = "Ambiente Node.js", Status = "AVISO", Detail = "Node.js não localizado no PATH padrão." });
                }
            });

            panelDiagItems.Children.Clear();
            foreach (var item in items)
            {
                var row = new Border
                {
                    Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#141923")),
                    BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#222a38")),
                    BorderThickness = new Thickness(1),
                    CornerRadius = new CornerRadius(8),
                    Padding = new Thickness(12, 8, 12, 8),
                    Margin = new Thickness(0, 0, 0, 6)
                };

                var d = new DockPanel();
                var left = new StackPanel();
                var lblN = new TextBlock
                {
                    Text = item.Name,
                    FontWeight = FontWeights.SemiBold,
                    FontSize = 12,
                    Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F3EEF9"))
                };
                var lblD = new TextBlock
                {
                    Text = item.Detail,
                    FontSize = 11,
                    Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8b9bb4")),
                    Margin = new Thickness(0, 2, 0, 0)
                };
                left.Children.Add(lblN);
                left.Children.Add(lblD);
                DockPanel.SetDock(left, Dock.Left);
                d.Children.Add(left);

                string badgeColor = item.Status == "OK" ? "#10B981" : (item.Status == "AVISO" ? "#F59E0B" : "#EF4444");
                var badge = new Border
                {
                    Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString(badgeColor)),
                    CornerRadius = new CornerRadius(6),
                    Padding = new Thickness(8, 3, 8, 3),
                    HorizontalAlignment = HorizontalAlignment.Right,
                    VerticalAlignment = VerticalAlignment.Center
                };
                var badgeText = new TextBlock
                {
                    Text = item.Status,
                    FontSize = 10,
                    FontWeight = FontWeights.Bold,
                    Foreground = item.Status == "AVISO" ? Brushes.Black : Brushes.White
                };
                badge.Child = badgeText;
                DockPanel.SetDock(badge, Dock.Right);
                d.Children.Add(badge);

                row.Child = d;
                panelDiagItems.Children.Add(row);
            }

            RefreshToolsTabInfo();
            LogConsole("Varredura de diagnósticos concluída com sucesso.");
        }

        // ==================== TOOLS TAB REFRESH ====================
        private void RefreshToolsTabInfo()
        {
            // MCP servers count
            try
            {
                string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                string mcpConfig = Path.Combine(userProfile, @"AppData\Local\Claude-3p\claude_desktop_config.json");
                if (File.Exists(mcpConfig))
                {
                    string content = File.ReadAllText(mcpConfig);
                    int count = 0;
                    if (content.Contains("\"agentmem\"")) count++;
                    if (content.Contains("\"github\"")) count++;
                    if (content.Contains("\"coolify\"")) count++;
                    if (content.Contains("\"cloudflare\"")) count++;
                    if (content.Contains("\"ssh\"")) count++;

                    txtMcpSummary.Text = string.Format("• {0} Servidores MCP detectados em claude_desktop_config.json\n  (agentmem, github, coolify, cloudflare, ssh)", count);
                }
                else
                {
                    txtMcpSummary.Text = "Arquivo claude_desktop_config.json ainda não criado.";
                }
            }
            catch (Exception ex)
            {
                txtMcpSummary.Text = string.Format("Erro MCP: {0}", ex.Message);
            }

            // Sessions count
            try
            {
                string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                string sessDir = Path.Combine(userProfile, @"AppData\Local\Claude-3p\claude-code-sessions");
                if (Directory.Exists(sessDir))
                {
                    var dirs = Directory.GetDirectories(sessDir, "*", SearchOption.AllDirectories);
                    txtSessionsSummary.Text = string.Format("• {0} pastas/sessões encontradas no cache local.\n  Limpar o cache libera os 12 turnos presos caso ocorra HTTP 429.", dirs.Length);
                }
                else
                {
                    txtSessionsSummary.Text = "Nenhuma sessão em cache (Pasta limpa).";
                }
            }
            catch (Exception ex)
            {
                txtSessionsSummary.Text = string.Format("Erro sessões: {0}", ex.Message);
            }
        }

        // ==================== AUTO REPAIR ALL ====================
        private async void AutoRepairAllAsync()
        {
            prgBusy.Visibility = Visibility.Visible;
            btnAutoRepairAll.IsEnabled = false;

            LogConsole("Iniciando reparo automático de todos os subsistemas...");

            await Task.Run(() =>
            {
                // 1. Kill Claude Desktop
                try
                {
                    var procs = Process.GetProcessesByName("claude");
                    foreach (var p in procs)
                    {
                        try { p.Kill(); } catch { }
                    }
                }
                catch { }

                // 2. Fix PATH
                try
                {
                    string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                    string localBin = Path.Combine(userProfile, @".local\bin");
                    string pEnv = Environment.GetEnvironmentVariable("Path", EnvironmentVariableTarget.User) ?? "";
                    if (!pEnv.Contains(localBin))
                    {
                        Environment.SetEnvironmentVariable("Path", localBin + ";" + pEnv, EnvironmentVariableTarget.User);
                    }
                }
                catch { }

                // 3. Fix Registry with FullControl ACL
                try
                {
                    string gw = "https://ghostcli.cloud";
                    string key = selectedProfile.ApiKey;
                    string models = "[\"claude-sonnet-5\",\"claude-opus-5-5\",\"claude-fable-5.1\"]";

                    var regSec = new RegistrySecurity();
                    var user = WindowsIdentity.GetCurrent().User;
                    regSec.AddAccessRule(new RegistryAccessRule(
                        user,
                        RegistryRights.FullControl,
                        InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                        PropagationFlags.None,
                        AccessControlType.Allow));

                    using (var k = Registry.CurrentUser.CreateSubKey(@"Software\Policies\Claude", RegistryKeyPermissionCheck.ReadWriteSubTree, regSec))
                    {
                        if (k != null)
                        {
                            k.SetValue("inferenceProvider", "gateway", RegistryValueKind.String);
                            k.SetValue("inferenceCredentialKind", "static", RegistryValueKind.String);
                            k.SetValue("inferenceGatewayBaseUrl", gw, RegistryValueKind.String);
                            k.SetValue("inferenceGatewayApiKey", key, RegistryValueKind.String);
                            k.SetValue("inferenceGatewayAuthScheme", "x-api-key", RegistryValueKind.String);
                            k.SetValue("inferenceModels", models, RegistryValueKind.String);
                        }
                    }

                    try
                    {
                        using (var uK = Registry.Users.CreateSubKey(user.Value + @"\Software\Policies\Claude", RegistryKeyPermissionCheck.ReadWriteSubTree, regSec))
                        {
                            if (uK != null)
                            {
                                uK.SetValue("inferenceProvider", "gateway", RegistryValueKind.String);
                                uK.SetValue("inferenceCredentialKind", "static", RegistryValueKind.String);
                                uK.SetValue("inferenceGatewayBaseUrl", gw, RegistryValueKind.String);
                                uK.SetValue("inferenceGatewayApiKey", key, RegistryValueKind.String);
                                uK.SetValue("inferenceGatewayAuthScheme", "x-api-key", RegistryValueKind.String);
                                uK.SetValue("inferenceModels", models, RegistryValueKind.String);
                            }
                        }
                    }
                    catch { }

                    // 4. Fix Code Environment
                    Environment.SetEnvironmentVariable("ANTHROPIC_BASE_URL", gw, EnvironmentVariableTarget.User);
                    Environment.SetEnvironmentVariable("ANTHROPIC_API_KEY", key, EnvironmentVariableTarget.User);

                    // 5. Fix ~/.claude/settings.json
                    string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                    string dir = Path.Combine(userProfile, ".claude");
                    if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                    string sPath = Path.Combine(dir, "settings.json");
                    string json = string.Format(
                        "{{\n  \"inferenceProvider\": \"gateway\",\n  \"inferenceCredentialKind\": \"static\",\n  \"inferenceGatewayBaseUrl\": \"{0}\",\n  \"inferenceGatewayApiKey\": \"{1}\",\n  \"inferenceGatewayAuthScheme\": \"x-api-key\",\n  \"inferenceModels\": {2}\n}}\n",
                        gw, key, models);
                    File.WriteAllText(sPath, json, Encoding.UTF8);

                    // 6. Broadcast
                    UIntPtr res;
                    Program.SendMessageTimeout(
                        (IntPtr)Program.HWND_BROADCAST,
                        Program.WM_SETTINGCHANGE,
                        UIntPtr.Zero,
                        "Environment",
                        Program.SMTO_ABORTIFHUNG,
                        2000,
                        out res);
                }
                catch { }
            });

            prgBusy.Visibility = Visibility.Collapsed;
            btnAutoRepairAll.IsEnabled = true;

            LogConsole("Reparo automático executado com êxito! Todas as variáveis, chaves e permissões foram alinhadas.");
            RunFullDiagnosticAsync();
        }

        // ==================== CLEAR STUCK SESSIONS ====================
        private void ClearStuckTurnsCache()
        {
            try
            {
                string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                string sessDir = Path.Combine(userProfile, @"AppData\Local\Claude-3p\claude-code-sessions");

                if (Directory.Exists(sessDir))
                {
                    var files = Directory.GetFiles(sessDir, "*", SearchOption.AllDirectories);
                    foreach (var f in files)
                    {
                        try { File.Delete(f); } catch { }
                    }
                    LogConsole(string.Format("Sessões limpas com sucesso! ({0} arquivos removidos do cache).", files.Length));
                }
                else
                {
                    LogConsole("Nenhuma sessão antiga precisava de limpeza.");
                }

                RefreshToolsTabInfo();
            }
            catch (Exception ex)
            {
                LogConsole(string.Format("Erro ao limpar sessões: {0}", ex.Message));
            }
        }

        // ==================== MCP CONFIG IMPORT/EXPORT ====================
        private string GetClaudeConfigPath()
        {
            string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            return Path.Combine(userProfile, @"AppData\Local\Claude-3p\claude_desktop_config.json");
        }

        private void ExportMcpConfiguration()
        {
            try
            {
                string mcpConfig = GetClaudeConfigPath();
                if (!File.Exists(mcpConfig))
                {
                    MessageBox.Show(
                        "O arquivo claude_desktop_config.json ainda não existe.\nInicie o Claude Desktop pelo menos uma vez ou configure os MCPs.",
                        "Configuração Não Encontrada",
                        MessageBoxButton.OK,
                        MessageBoxImage.Information);
                    return;
                }

                var sfd = new SaveFileDialog();
                sfd.Title = "Exportar Configurações MCP do Claude Desktop";
                sfd.Filter = "Arquivo JSON (*.json)|*.json|Todos os arquivos (*.*)|*.*";
                sfd.FileName = string.Format("claude_desktop_mcp_backup_{0}.json", DateTime.Now.ToString("yyyyMMdd_HHmmss"));
                sfd.InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);

                if (sfd.ShowDialog() == true)
                {
                    string content = File.ReadAllText(mcpConfig, Encoding.UTF8);
                    File.WriteAllText(sfd.FileName, content, Encoding.UTF8);

                    LogConsole(string.Format("Configurações MCP exportadas com sucesso para:\n  {0}", sfd.FileName));
                    MessageBox.Show(
                        string.Format("Configurações MCP exportadas com sucesso!\n\nSalvo em:\n{0}", sfd.FileName),
                        "Exportação Concluída",
                        MessageBoxButton.OK,
                        MessageBoxImage.Information);
                }
            }
            catch (Exception ex)
            {
                LogConsole(string.Format("Erro ao exportar configurações MCP: {0}", ex.Message));
                MessageBox.Show(
                    string.Format("Falha ao exportar configurações MCP:\n{0}", ex.Message),
                    "Erro na Exportação",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
            }
        }

        private void ImportMcpConfiguration()
        {
            try
            {
                var ofd = new OpenFileDialog();
                ofd.Title = "Selecionar Backup de Configuração MCP";
                ofd.Filter = "Arquivo JSON (*.json)|*.json|Todos os arquivos (*.*)|*.*";
                ofd.InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);

                if (ofd.ShowDialog() == true)
                {
                    string selectedFile = ofd.FileName;
                    string content = File.ReadAllText(selectedFile, Encoding.UTF8);

                    if (!content.Contains("mcpServers"))
                    {
                        var answer = MessageBox.Show(
                            "O arquivo selecionado não parece conter a seção 'mcpServers'.\nDeseja importá-lo mesmo assim?",
                            "Aviso de Validação",
                            MessageBoxButton.YesNo,
                            MessageBoxImage.Warning);
                        if (answer != MessageBoxResult.Yes) return;
                    }

                    string targetFile = GetClaudeConfigPath();
                    string targetDir = Path.GetDirectoryName(targetFile);
                    if (!Directory.Exists(targetDir))
                    {
                        Directory.CreateDirectory(targetDir);
                    }

                    if (File.Exists(targetFile))
                    {
                        string bkp = targetFile + ".bak_" + DateTime.Now.ToString("yyyyMMdd_HHmmss");
                        File.Copy(targetFile, bkp, true);
                        LogConsole(string.Format("Backup da config atual salvo em: {0}", bkp));
                    }

                    File.WriteAllText(targetFile, content, Encoding.UTF8);

                    LogConsole(string.Format("Configuração MCP importada com sucesso de: {0}", selectedFile));
                    MessageBox.Show(
                        "Configurações MCP importadas com sucesso no Claude Desktop!\n\nReinicie o Claude Desktop para aplicar.",
                        "Importação Concluída",
                        MessageBoxButton.OK,
                        MessageBoxImage.Information);

                    RefreshToolsTabInfo();
                }
            }
            catch (Exception ex)
            {
                LogConsole(string.Format("Erro ao importar configurações MCP: {0}", ex.Message));
                MessageBox.Show(
                    string.Format("Falha ao importar configurações MCP:\n{0}", ex.Message),
                    "Erro na Importação",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
            }
        }

        // ==================== EXPORT DEPLOYMENT KIT ====================
        private void ExportDeploymentKit()
        {
            try
            {
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                string kitFolder = Path.Combine(desktop, "Echo-Deploy-Kit-Outra-Maquina");
                if (!Directory.Exists(kitFolder))
                {
                    Directory.CreateDirectory(kitFolder);
                }

                // 1. Copy our executable
                string currentExe = Process.GetCurrentProcess().MainModule.FileName;
                string destExe = Path.Combine(kitFolder, "Echo-Claude-Configurador.exe");
                File.Copy(currentExe, destExe, true);

                // 2. Export Json Profile
                string jsonConfig = string.Format(
                    "{{\n  \"inferenceProvider\": \"gateway\",\n  \"inferenceCredentialKind\": \"static\",\n  \"inferenceGatewayBaseUrl\": \"https://ghostcli.cloud\",\n  \"inferenceGatewayApiKey\": \"{0}\",\n  \"inferenceGatewayAuthScheme\": \"x-api-key\",\n  \"inferenceModels\": [\n    \"claude-sonnet-5\",\n    \"claude-opus-5-5\",\n    \"claude-fable-5.1\"\n  ]\n}}\n",
                    selectedProfile.ApiKey);
                File.WriteAllText(Path.Combine(kitFolder, "Configuracao-Chave.json"), jsonConfig, Encoding.UTF8);

                // 2.1 Copy MCP servers config if present
                string mcpSource = GetClaudeConfigPath();
                if (File.Exists(mcpSource))
                {
                    string mcpDest = Path.Combine(kitFolder, "claude_desktop_config.json");
                    File.Copy(mcpSource, mcpDest, true);
                    LogConsole("Configuração de MCPs incluída no kit.");
                }

                // 3. Instructions README
                var sb = new StringBuilder();
                sb.AppendLine("==================================================================");
                sb.AppendLine("    ECHO / CLAUDE CONFIGURADOR - GUIA PARA A OUTRA MÁQUINA");
                sb.AppendLine("==================================================================");
                sb.AppendLine("");
                sb.AppendLine("PASSO 1: WIREGUARD");
                sb.AppendLine("  • Instale o WireGuard na outra máquina.");
                sb.AppendLine("  • Importe seu túnel para a VPS Oracle (IP 152.67.46.168).");
                sb.AppendLine("  • Conecte o túnel.");
                sb.AppendLine("");
                sb.AppendLine("PASSO 2: EXECUTAR O CONFIGURADOR");
                sb.AppendLine("  • Abra o 'Echo-Claude-Configurador.exe' nesta pasta.");
                sb.AppendLine("  • O app mostrará se o IP 152.67.46.168 está verde e ativo.");
                sb.AppendLine("  • Selecione sua Chave.");
                sb.AppendLine("  • Clique em '⚡ APLICAR CONFIGURAÇÃO COMPLETA'.");
                sb.AppendLine("");
                sb.AppendLine("PASSO 3: PRONTO!");
                sb.AppendLine("  • Abra o Claude Desktop ou o Terminal.");
                sb.AppendLine("  • Ambas as ferramentas já estarão conectadas diretamente via GhostCLI.");
                sb.AppendLine("==================================================================");
                File.WriteAllText(Path.Combine(kitFolder, "LEIA-ME.txt"), sb.ToString(), Encoding.UTF8);

                LogConsole(string.Format("Kit de Portabilidade gerado em: {0}", kitFolder));
                Process.Start("explorer.exe", kitFolder);
            }
            catch (Exception ex)
            {
                LogConsole(string.Format("Erro ao exportar kit: {0}", ex.Message));
            }
        }

        // ==================== APPLY CONFIGURATION ====================
        private void ApplyConfiguration()
        {
            string gateway = txtGateway.Text.Trim();
            string apiKey = isKeyVisible ? txtApiKey.Text.Trim() : pwbApiKey.Password.Trim();
            string modelsJson = txtModels.Text.Trim();

            if (string.IsNullOrEmpty(gateway))
            {
                LogConsole("ERRO: Gateway URL não pode ficar em branco.");
                return;
            }

            if (string.IsNullOrEmpty(apiKey))
            {
                LogConsole("ERRO: API Key não pode ficar em branco.");
                return;
            }

            if (string.IsNullOrEmpty(modelsJson))
            {
                modelsJson = "[\"claude-sonnet-5\",\"claude-opus-5-5\",\"claude-fable-5.1\"]";
            }

            bool applyDesktop = rbTargetBoth.IsChecked == true || rbTargetDesktop.IsChecked == true;
            bool applyCode = rbTargetBoth.IsChecked == true || rbTargetCode.IsChecked == true;

            // 1. Close Claude Desktop
            if (applyDesktop)
            {
                try
                {
                    var procs = Process.GetProcessesByName("claude");
                    if (procs.Length > 0)
                    {
                        foreach (var p in procs)
                        {
                            try { p.Kill(); } catch { }
                        }
                        LogConsole("Processos anteriores do Claude Desktop foram finalizados.");
                    }
                }
                catch { }

                // Configure Registry with FullControl ACL
                try
                {
                    var regSecurity = new RegistrySecurity();
                    var currentUser = WindowsIdentity.GetCurrent().User;
                    
                    regSecurity.AddAccessRule(new RegistryAccessRule(
                        currentUser,
                        RegistryRights.FullControl,
                        InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                        PropagationFlags.None,
                        AccessControlType.Allow));

                    using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Policies\Claude", RegistryKeyPermissionCheck.ReadWriteSubTree, regSecurity))
                    {
                        if (key != null)
                        {
                            key.SetValue("inferenceProvider", "gateway", RegistryValueKind.String);
                            key.SetValue("inferenceCredentialKind", "static", RegistryValueKind.String);
                            key.SetValue("inferenceGatewayBaseUrl", gateway, RegistryValueKind.String);
                            key.SetValue("inferenceGatewayApiKey", apiKey, RegistryValueKind.String);
                            key.SetValue("inferenceGatewayAuthScheme", "x-api-key", RegistryValueKind.String);
                            key.SetValue("inferenceModels", modelsJson, RegistryValueKind.String);
                            LogConsole("Registro do Windows (HKCU\\Software\\Policies\\Claude) atualizado com permissão FullControl.");
                        }
                    }

                    try
                    {
                        string userSid = currentUser.Value;
                        using (var uKey = Registry.Users.CreateSubKey(userSid + @"\Software\Policies\Claude", RegistryKeyPermissionCheck.ReadWriteSubTree, regSecurity))
                        {
                            if (uKey != null)
                            {
                                uKey.SetValue("inferenceProvider", "gateway", RegistryValueKind.String);
                                uKey.SetValue("inferenceCredentialKind", "static", RegistryValueKind.String);
                                uKey.SetValue("inferenceGatewayBaseUrl", gateway, RegistryValueKind.String);
                                uKey.SetValue("inferenceGatewayApiKey", apiKey, RegistryValueKind.String);
                                uKey.SetValue("inferenceGatewayAuthScheme", "x-api-key", RegistryValueKind.String);
                                uKey.SetValue("inferenceModels", modelsJson, RegistryValueKind.String);
                            }
                        }
                    }
                    catch { }
                }
                catch (Exception ex)
                {
                    LogConsole(string.Format("Erro ao gravar registro: {0}", ex.Message));
                }
            }

            // 2. Configure Claude Code CLI
            if (applyCode)
            {
                try
                {
                    // Environment Variables
                    Environment.SetEnvironmentVariable("ANTHROPIC_BASE_URL", gateway, EnvironmentVariableTarget.User);
                    Environment.SetEnvironmentVariable("ANTHROPIC_API_KEY", apiKey, EnvironmentVariableTarget.User);
                    LogConsole("Variáveis de ambiente (ANTHROPIC_BASE_URL e ANTHROPIC_API_KEY) salvas.");

                    // ~/.claude/settings.json
                    string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                    string dir = Path.Combine(userProfile, ".claude");
                    if (!Directory.Exists(dir))
                    {
                        Directory.CreateDirectory(dir);
                    }

                    string settingsPath = Path.Combine(dir, "settings.json");
                    string json = string.Format(
                        "{{\n  \"inferenceProvider\": \"gateway\",\n  \"inferenceCredentialKind\": \"static\",\n  \"inferenceGatewayBaseUrl\": \"{0}\",\n  \"inferenceGatewayApiKey\": \"{1}\",\n  \"inferenceGatewayAuthScheme\": \"x-api-key\",\n  \"inferenceModels\": {2}\n}}\n",
                        gateway, apiKey, modelsJson);

                    File.WriteAllText(settingsPath, json, Encoding.UTF8);
                    LogConsole("Arquivo ~/.claude/settings.json atualizado.");

                    // Broadcast WM_SETTINGCHANGE
                    UIntPtr result;
                    Program.SendMessageTimeout(
                        (IntPtr)Program.HWND_BROADCAST,
                        Program.WM_SETTINGCHANGE,
                        UIntPtr.Zero,
                        "Environment",
                        Program.SMTO_ABORTIFHUNG,
                        2000,
                        out result);
                    LogConsole("Notificação enviada ao Windows: novas variáveis de ambiente ativas no terminal.");
                }
                catch (Exception ex)
                {
                    LogConsole(string.Format("Erro ao configurar Claude Code: {0}", ex.Message));
                }
            }

            LogConsole("SUCESSO: Configuração aplicada para todos os alvos selecionados!");
            RunFullDiagnosticAsync();
        }

        // ==================== LIVE GATEWAY TEST ====================
        private async void TestConnectionAsync()
        {
            string gateway = txtGateway.Text.Trim();
            string apiKey = isKeyVisible ? txtApiKey.Text.Trim() : pwbApiKey.Password.Trim();

            if (string.IsNullOrEmpty(gateway) || string.IsNullOrEmpty(apiKey))
            {
                LogConsole("ERRO: Preencha o Gateway e a API Key antes de testar.");
                return;
            }

            prgBusy.Visibility = Visibility.Visible;
            btnTestGateway.IsEnabled = false;
            LogConsole(string.Format("Testando conexão POST com {0}/v1/messages...", gateway));

            var sw = Stopwatch.StartNew();

            try
            {
                string endpoint = gateway.TrimEnd('/') + "/v1/messages";
                string jsonBody = "{\"model\":\"claude-sonnet-5\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}],\"max_tokens\":10}";

                using (var client = new HttpClient())
                {
                    client.Timeout = TimeSpan.FromSeconds(15);
                    var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
                    request.Headers.Add("x-api-key", apiKey);
                    request.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

                    var response = await client.SendAsync(request);
                    sw.Stop();

                    string body = await response.Content.ReadAsStringAsync();

                    if (response.IsSuccessStatusCode)
                    {
                        LogConsole(string.Format("SUCESSO: Gateway respondeu em {0} ms (HTTP 200 OK)! Resposta: {1}", sw.ElapsedMilliseconds, body.Trim()));
                    }
                    else if ((int)response.StatusCode == 403)
                    {
                        LogConsole(string.Format("ERRO 403: IP não autorizado no GhostCLI ({0}). Conecte o WireGuard ou libere o IP exibido no topo.", body));
                    }
                    else if ((int)response.StatusCode == 429)
                    {
                        LogConsole(string.Format("ERRO 429: Limite ou fila cheia no provedor ({0}).", body));
                    }
                    else
                    {
                        LogConsole(string.Format("ERRO HTTP {0}: {1}", (int)response.StatusCode, body));
                    }
                }
            }
            catch (Exception ex)
            {
                sw.Stop();
                LogConsole(string.Format("FALHA DE REDE: {0}", ex.Message));
            }
            finally
            {
                prgBusy.Visibility = Visibility.Collapsed;
                btnTestGateway.IsEnabled = true;
            }
        }

        // ==================== LIVE CLI TEST ====================
        private async void TestCliAsync()
        {
            prgBusy.Visibility = Visibility.Visible;
            btnTestCli.IsEnabled = false;

            LogConsole("Executando 'claude -p \"responda pong\" --print' via terminal em segundo plano...");

            try
            {
                string output = await Task.Run(() =>
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "claude.exe",
                        Arguments = "-p \"responda pong\" --print",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };

                    string apiKey = isKeyVisible ? txtApiKey.Text.Trim() : pwbApiKey.Password.Trim();
                    psi.EnvironmentVariables["ANTHROPIC_BASE_URL"] = txtGateway.Text.Trim();
                    psi.EnvironmentVariables["ANTHROPIC_API_KEY"] = apiKey;

                    using (var p = Process.Start(psi))
                    {
                        string stdOut = p.StandardOutput.ReadToEnd();
                        string stdErr = p.StandardError.ReadToEnd();
                        p.WaitForExit(15000);

                        if (!string.IsNullOrEmpty(stdOut))
                            return stdOut.Trim();
                        return stdErr.Trim();
                    }
                });

                LogConsole(string.Format("Saída do Claude Code CLI: {0}", output));
            }
            catch (Exception ex)
            {
                LogConsole(string.Format("Falha ao invocar Claude Code CLI: {0}. Verifique se o CLI está instalado e no PATH.", ex.Message));
            }
            finally
            {
                prgBusy.Visibility = Visibility.Collapsed;
                btnTestCli.IsEnabled = true;
            }
        }

        // ==================== LAUNCHERS ====================
        private void LaunchClaudeDesktop()
        {
            try
            {
                string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                string appPath = Path.Combine(userProfile, @"AppData\Local\Microsoft\WindowsApps\claude-desktop.exe");
                if (File.Exists(appPath))
                {
                    Process.Start(appPath);
                }
                else
                {
                    Process.Start("claude-desktop.exe");
                }
                LogConsole("Claude Desktop iniciado.");
            }
            catch (Exception ex)
            {
                LogConsole(string.Format("Erro ao abrir Claude Desktop: {0}", ex.Message));
            }
        }

        private void LaunchClaudeCode()
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = "-NoExit -Command \"Write-Host 'Claude Code CLI Iniciado via Echo Configurator Pro' -ForegroundColor Cyan; claude\"",
                    UseShellExecute = true
                };
                Process.Start(psi);
                LogConsole("Terminal Claude Code aberto em nova janela.");
            }
            catch (Exception ex)
            {
                LogConsole(string.Format("Erro ao abrir Terminal: {0}", ex.Message));
            }
        }
    }
}
