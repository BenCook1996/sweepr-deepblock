using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

[assembly: AssemblyTitle("SWEEPR Deepblock 1-Click Installer")]
[assembly: AssemblyDescription("SWEEPR Deepblock Automated Browser Extension Setup for Chrome, Edge, and Brave")]
[assembly: AssemblyConfiguration("")]
[assembly: AssemblyCompany("SWEEPR Technologies")]
[assembly: AssemblyProduct("SWEEPR Deepblock")]
[assembly: AssemblyCopyright("Copyright (c) 2026 SWEEPR Technologies")]
[assembly: AssemblyTrademark("SWEEPR")]
[assembly: AssemblyCulture("")]
[assembly: ComVisible(false)]
[assembly: AssemblyVersion("1.2.0.0")]
[assembly: AssemblyFileVersion("1.2.0.0")]

namespace SweeprDeepblockInstaller
{
    public class BrowserTarget
    {
        public string Id;
        public string Name;
        public string ProcessName;
        public string ExePath;
        public string UserDataDir;
        public string ExtensionsUrl;

        public override string ToString()
        {
            return Name;
        }
    }

    public class MainForm : Form
    {
        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool IsIconic(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern IntPtr FindWindowEx(IntPtr parentHandle, IntPtr childAfter, string lclassName, string windowTitle);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, string lParam);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        private const int SW_RESTORE = 9;
        private const uint WM_SETTEXT = 0x000C;
        private const uint BM_CLICK = 0x00F5;

        private Label titleLabel;
        private Label subtitleLabel;
        private Label statusLabel;
        private Label stepsBox;
        private ComboBox browserSelector;
        private ProgressBar progressBar;
        private Button launchBrowserBtn;
        private Button copyPathBtn;
        private System.Windows.Forms.Timer folderDialogWatcher;
        private bool dialogAutoFilled = false;
        private bool isRunningSequence = false;
        private string installDir;
        private List<BrowserTarget> detectedBrowsers = new List<BrowserTarget>();

        public MainForm()
        {
            Text = "SWEEPR Deepblock — 1-Click Browser Installer (v1.2)";
            Size = new Size(540, 435);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            TopMost = true;
            BackColor = Color.FromArgb(248, 250, 252);
            Font = new Font("Segoe UI", 9.5F, FontStyle.Regular);

            installDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SWEEPR",
                "Deepblock",
                "Extension"
            );

            Panel headerPanel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 80,
                BackColor = Color.FromArgb(6, 78, 59),
                Padding = new Padding(22, 14, 22, 12)
            };

            titleLabel = new Label
            {
                Text = "SWEEPR Deepblock — 1-Click Auto-Installer",
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 13.5F, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(22, 14)
            };

            subtitleLabel = new Label
            {
                Text = "Opens chrome://extensions & automatically loads the extension folder",
                ForeColor = Color.FromArgb(167, 243, 208),
                Font = new Font("Segoe UI", 9.25F, FontStyle.Regular),
                AutoSize = true,
                Location = new Point(24, 44)
            };

            headerPanel.Controls.Add(titleLabel);
            headerPanel.Controls.Add(subtitleLabel);

            statusLabel = new Label
            {
                Text = "Unpacking extension files to AppData...",
                ForeColor = Color.FromArgb(6, 95, 70),
                Font = new Font("Segoe UI", 9.75F, FontStyle.Bold),
                AutoSize = false,
                Size = new Size(480, 42),
                Location = new Point(24, 92)
            };

            progressBar = new ProgressBar
            {
                Location = new Point(24, 136),
                Size = new Size(476, 14),
                Style = ProgressBarStyle.Continuous,
                Value = 25
            };

            Label browserLabel = new Label
            {
                Text = "Target Browser:",
                ForeColor = Color.FromArgb(55, 65, 81),
                Font = new Font("Segoe UI", 9F, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(24, 164)
            };

            browserSelector = new ComboBox
            {
                Location = new Point(130, 160),
                Size = new Size(370, 26),
                DropDownStyle = ComboBoxStyle.DropDownList
            };

            stepsBox = new Label
            {
                Text = "How this installer works (without closing your open tabs):\r\n" +
                       "1. Click the green button below — it opens chrome://extensions in a new tab.\r\n" +
                       "2. It automatically enables Developer Mode, clicks 'Load unpacked', and selects the unpacked SWEEPR Deepblock folder for you!",
                ForeColor = Color.FromArgb(30, 41, 59),
                BackColor = Color.FromArgb(236, 253, 245),
                BorderStyle = BorderStyle.FixedSingle,
                Padding = new Padding(10),
                Font = new Font("Segoe UI", 9F, FontStyle.Regular),
                AutoSize = false,
                Size = new Size(476, 84),
                Location = new Point(24, 196)
            };

            launchBrowserBtn = new Button
            {
                Text = "✓ Install & Load into Google Chrome Now",
                Location = new Point(24, 292),
                Size = new Size(476, 46),
                BackColor = Color.FromArgb(5, 150, 105),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 10.5F, FontStyle.Bold),
                Enabled = false,
                Cursor = Cursors.Hand
            };
            launchBrowserBtn.FlatAppearance.BorderSize = 0;
            launchBrowserBtn.Click += OnActivateBrowserClick;

            copyPathBtn = new Button
            {
                Text = "Copy Extension Folder Path to Clipboard",
                Location = new Point(24, 346),
                Size = new Size(476, 34),
                BackColor = Color.White,
                ForeColor = Color.FromArgb(6, 95, 70),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 8.75F, FontStyle.Bold),
                Enabled = false,
                Cursor = Cursors.Hand
            };
            copyPathBtn.FlatAppearance.BorderColor = Color.FromArgb(167, 243, 208);
            copyPathBtn.Click += OnCopyPathClick;

            Controls.Add(headerPanel);
            Controls.Add(statusLabel);
            Controls.Add(progressBar);
            Controls.Add(browserLabel);
            Controls.Add(browserSelector);
            Controls.Add(stepsBox);
            Controls.Add(launchBrowserBtn);
            Controls.Add(copyPathBtn);

            Shown += OnFormShown;
        }

        private async void OnFormShown(object sender, EventArgs e)
        {
            await Task.Run(() => RunExtractionAndDetection());

            progressBar.Value = 100;
            browserSelector.Items.Clear();
            foreach (BrowserTarget bt in detectedBrowsers)
            {
                browserSelector.Items.Add(bt);
            }
            if (browserSelector.Items.Count > 0)
            {
                browserSelector.SelectedIndex = 0;
            }

            try
            {
                Clipboard.SetText(installDir);
            }
            catch { }

            string browserName = detectedBrowsers.Count > 0 ? detectedBrowsers[0].Name : "Google Chrome";
            statusLabel.Text = "✓ Extension unpacked to AppData!\r\nClick the green button below to auto-load it into " + browserName + ".";
            launchBrowserBtn.Text = "✓ Install & Load into " + browserName + " Now";
            launchBrowserBtn.Enabled = true;
            copyPathBtn.Enabled = true;
            copyPathBtn.Text = "✓ Path Copied: " + installDir;

            // Continuously watch for the Windows "Select the extension directory" (#32770) folder dialog
            folderDialogWatcher = new System.Windows.Forms.Timer { Interval = 100 };
            folderDialogWatcher.Tick += OnWatchFolderDialogTick;
            folderDialogWatcher.Start();
        }

        private void OnWatchFolderDialogTick(object sender, EventArgs e)
        {
            if (dialogAutoFilled) return;

            string[] dialogTitles = new string[]
            {
                "Select the extension directory",
                "Select Extension Directory",
                "Browse For Folder"
            };

            IntPtr dlgHwnd = IntPtr.Zero;
            foreach (string title in dialogTitles)
            {
                dlgHwnd = FindWindow("#32770", title);
                if (dlgHwnd != IntPtr.Zero) break;
            }

            if (dlgHwnd != IntPtr.Zero)
            {
                dialogAutoFilled = true;
                try
                {
                    Clipboard.SetText(installDir);
                }
                catch { }

                try
                {
                    SetForegroundWindow(dlgHwnd);
                    Thread.Sleep(150);

                    IntPtr editHwnd = FindEditControlRecursive(dlgHwnd);
                    if (editHwnd != IntPtr.Zero)
                    {
                        SendMessage(editHwnd, WM_SETTEXT, IntPtr.Zero, installDir);
                        Thread.Sleep(80);
                    }

                    // Also paste via keyboard into the focused Folder box and press Enter
                    SendKeys.SendWait("^v");
                    Thread.Sleep(100);

                    IntPtr okBtn = FindWindowEx(dlgHwnd, IntPtr.Zero, "Button", "Select Folder");
                    if (okBtn == IntPtr.Zero)
                    {
                        okBtn = FindWindowEx(dlgHwnd, IntPtr.Zero, "Button", "&Select Folder");
                    }
                    if (okBtn != IntPtr.Zero)
                    {
                        SendMessage(okBtn, BM_CLICK, IntPtr.Zero, IntPtr.Zero);
                    }
                    else
                    {
                        SendKeys.SendWait("{ENTER}");
                    }

                    statusLabel.Text = "🎉 SWEEPR Deepblock is now installed & active in your browser!";
                    launchBrowserBtn.Text = "✓ Installed Successfully!";
                    launchBrowserBtn.Enabled = true;
                }
                catch { }
            }
        }

        private IntPtr FindEditControlRecursive(IntPtr parent)
        {
            IntPtr child = FindWindowEx(parent, IntPtr.Zero, null, null);
            IntPtr lastFoundEdit = IntPtr.Zero;
            while (child != IntPtr.Zero)
            {
                IntPtr edit = FindWindowEx(child, IntPtr.Zero, "Edit", null);
                if (edit != IntPtr.Zero)
                {
                    lastFoundEdit = edit;
                }
                IntPtr nested = FindEditControlRecursive(child);
                if (nested != IntPtr.Zero)
                {
                    lastFoundEdit = nested;
                }
                child = FindWindowEx(parent, child, null, null);
            }
            IntPtr directEdit = FindWindowEx(parent, IntPtr.Zero, "Edit", null);
            if (directEdit != IntPtr.Zero)
            {
                lastFoundEdit = directEdit;
            }
            return lastFoundEdit;
        }

        private IntPtr FindBrowserMainWindow(string targetProcessName)
        {
            IntPtr foundHwnd = IntPtr.Zero;
            HashSet<uint> browserPids = new HashSet<uint>();
            foreach (Process p in Process.GetProcessesByName(targetProcessName))
            {
                browserPids.Add((uint)p.Id);
            }

            if (browserPids.Count == 0) return IntPtr.Zero;

            EnumWindows((hWnd, lParam) =>
            {
                if (!IsWindowVisible(hWnd)) return true;
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                if (!browserPids.Contains(pid)) return true;

                StringBuilder classSb = new StringBuilder(128);
                GetClassName(hWnd, classSb, 128);
                if (classSb.ToString() != "Chrome_WidgetWin_1") return true;

                StringBuilder titleSb = new StringBuilder(256);
                GetWindowText(hWnd, titleSb, 256);
                if (titleSb.Length > 0)
                {
                    foundHwnd = hWnd;
                    return false;
                }
                return true;
            }, IntPtr.Zero);

            return foundHwnd;
        }

        private bool IsDeveloperModeEnabledInActiveProfile(string userDataDir)
        {
            try
            {
                if (string.IsNullOrEmpty(userDataDir) || !Directory.Exists(userDataDir)) return false;

                string latestPrefFile = null;
                DateTime latestWrite = DateTime.MinValue;

                List<string> profileDirs = new List<string>();
                string defaultDir = Path.Combine(userDataDir, "Default");
                if (Directory.Exists(defaultDir)) profileDirs.Add(defaultDir);
                foreach (string d in Directory.GetDirectories(userDataDir, "Profile *"))
                {
                    profileDirs.Add(d);
                }

                foreach (string pDir in profileDirs)
                {
                    string pref = Path.Combine(pDir, "Preferences");
                    if (File.Exists(pref))
                    {
                        DateTime lw = File.GetLastWriteTimeUtc(pref);
                        if (lw > latestWrite)
                        {
                            latestWrite = lw;
                            latestPrefFile = pref;
                        }
                    }
                }

                if (latestPrefFile != null)
                {
                    string raw = File.ReadAllText(latestPrefFile);
                    if (Regex.IsMatch(raw, "\"developer_mode\"\\s*:\\s*true"))
                    {
                        return true;
                    }
                }
            }
            catch { }
            return false;
        }

        private void RunExtractionAndDetection()
        {
            try
            {
                if (Directory.Exists(installDir))
                {
                    try { Directory.Delete(installDir, true); } catch { }
                }
                Directory.CreateDirectory(installDir);

                Assembly asm = Assembly.GetExecutingAssembly();
                using (Stream resStream = asm.GetManifestResourceStream("SWEEPR.Extension.zip"))
                {
                    if (resStream != null)
                    {
                        using (ZipArchive archive = new ZipArchive(resStream, ZipArchiveMode.Read))
                        {
                            foreach (ZipArchiveEntry entry in archive.Entries)
                            {
                                string fullPath = Path.GetFullPath(Path.Combine(installDir, entry.FullName));
                                if (!fullPath.StartsWith(Path.GetFullPath(installDir), StringComparison.OrdinalIgnoreCase))
                                    continue;

                                if (string.IsNullOrEmpty(entry.Name))
                                {
                                    Directory.CreateDirectory(fullPath);
                                    continue;
                                }

                                Directory.CreateDirectory(Path.GetDirectoryName(fullPath));
                                entry.ExtractToFile(fullPath, true);
                            }
                        }
                    }
                }

                DetectInstalledBrowsers();
            }
            catch (Exception ex)
            {
                Invoke((Action)(() =>
                {
                    statusLabel.Text = "Setup notice: " + ex.Message;
                }));
            }
        }

        private void DetectInstalledBrowsers()
        {
            detectedBrowsers.Clear();
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            string[] chromePaths = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(localAppData, "Google\\Chrome\\Application\\chrome.exe")
            };
            foreach (string p in chromePaths)
            {
                if (File.Exists(p))
                {
                    detectedBrowsers.Add(new BrowserTarget
                    {
                        Id = "chrome",
                        Name = "Google Chrome",
                        ProcessName = "chrome",
                        ExePath = p,
                        UserDataDir = Path.Combine(localAppData, "Google\\Chrome\\User Data"),
                        ExtensionsUrl = "chrome://extensions"
                    });
                    break;
                }
            }

            string[] edgePaths = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft\\Edge\\Application\\msedge.exe")
            };
            foreach (string p in edgePaths)
            {
                if (File.Exists(p))
                {
                    detectedBrowsers.Add(new BrowserTarget
                    {
                        Id = "edge",
                        Name = "Microsoft Edge",
                        ProcessName = "msedge",
                        ExePath = p,
                        UserDataDir = Path.Combine(localAppData, "Microsoft\\Edge\\User Data"),
                        ExtensionsUrl = "edge://extensions"
                    });
                    break;
                }
            }

            string[] bravePaths = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
                Path.Combine(localAppData, "BraveSoftware\\Brave-Browser\\Application\\brave.exe")
            };
            foreach (string p in bravePaths)
            {
                if (File.Exists(p))
                {
                    detectedBrowsers.Add(new BrowserTarget
                    {
                        Id = "brave",
                        Name = "Brave Browser",
                        ProcessName = "brave",
                        ExePath = p,
                        UserDataDir = Path.Combine(localAppData, "BraveSoftware\\Brave-Browser\\User Data"),
                        ExtensionsUrl = "brave://extensions"
                    });
                    break;
                }
            }
        }

        private async void OnActivateBrowserClick(object sender, EventArgs e)
        {
            if (isRunningSequence) return;
            isRunningSequence = true;
            dialogAutoFilled = false;

            BrowserTarget target = browserSelector.SelectedItem as BrowserTarget;
            if (target == null && detectedBrowsers.Count > 0)
            {
                target = detectedBrowsers[0];
            }

            if (target == null)
            {
                isRunningSequence = false;
                return;
            }

            launchBrowserBtn.Enabled = false;
            launchBrowserBtn.Text = "Opening " + target.Name + " Extensions...";

            // Dock helper window cleanly at bottom-right so it doesn't cover Chrome's top bar
            try
            {
                Rectangle wa = Screen.PrimaryScreen.WorkingArea;
                Location = new Point(Math.Max(20, wa.Right - Width - 24), Math.Max(20, wa.Bottom - Height - 24));
            }
            catch { }

            bool devModeAlreadyOn = IsDeveloperModeEnabledInActiveProfile(target.UserDataDir);

            IntPtr browserHwnd = FindBrowserMainWindow(target.ProcessName);
            if (browserHwnd == IntPtr.Zero)
            {
                try
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = target.ExePath,
                        UseShellExecute = true
                    });
                }
                catch { }

                for (int i = 0; i < 15; i++)
                {
                    await Task.Delay(200);
                    browserHwnd = FindBrowserMainWindow(target.ProcessName);
                    if (browserHwnd != IntPtr.Zero) break;
                }
            }

            if (browserHwnd != IntPtr.Zero)
            {
                if (IsIconic(browserHwnd))
                {
                    ShowWindow(browserHwnd, SW_RESTORE);
                    await Task.Delay(150);
                }

                // 1. Copy chrome://extensions to clipboard, focus Chrome, open New Tab (Ctrl+T), paste & hit Enter
                try
                {
                    Clipboard.SetText(target.ExtensionsUrl);
                }
                catch { }

                SetForegroundWindow(browserHwnd);
                await Task.Delay(180);
                SendKeys.SendWait("^t");
                await Task.Delay(200);
                SendKeys.SendWait("^v{ENTER}");

                // 2. Restore unpacked extension folder path to clipboard immediately
                try
                {
                    Clipboard.SetText(installDir);
                }
                catch { }

                statusLabel.Text = "Opened " + target.ExtensionsUrl + " — enabling Developer Mode & clicking 'Load unpacked'...";

                // 3. Wait for chrome://extensions to render (focus starts inside 'Search extensions' box)
                await Task.Delay(800);
                SetForegroundWindow(browserHwnd);
                await Task.Delay(100);

                if (!devModeAlreadyOn)
                {
                    // Tab 1 -> Developer Mode toggle, Space -> turn ON, Tab 2 -> Load unpacked button, Enter -> open folder picker
                    SendKeys.SendWait("{TAB}");
                    await Task.Delay(120);
                    SendKeys.SendWait(" ");
                    await Task.Delay(300);
                    SendKeys.SendWait("{TAB}");
                    await Task.Delay(120);
                    SendKeys.SendWait("{ENTER}");
                }
                else
                {
                    // Developer Mode is already ON: Tab 1 -> Developer Mode toggle, Tab 2 -> Load unpacked button, Enter -> open folder picker
                    SendKeys.SendWait("{TAB}");
                    await Task.Delay(120);
                    SendKeys.SendWait("{TAB}");
                    await Task.Delay(120);
                    SendKeys.SendWait("{ENTER}");
                }

                await Task.Delay(600);
            }

            if (!dialogAutoFilled)
            {
                statusLabel.Text = "👉 If the folder box didn't open yet: toggle 'Developer mode' ON (top-right) & click 'Load unpacked' (top-left) — this installer will auto-select the folder!";
                launchBrowserBtn.Text = "↻ Try Auto-Load Again in " + target.Name;
                launchBrowserBtn.Enabled = true;
            }

            isRunningSequence = false;
        }

        private void OnCopyPathClick(object sender, EventArgs e)
        {
            try
            {
                Clipboard.SetText(installDir);
            }
            catch { }

            statusLabel.Text = "✓ Folder path copied to clipboard:\r\n" + installDir;
            copyPathBtn.Text = "✓ Copied: " + installDir;
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}
