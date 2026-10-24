using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Automation;
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
[assembly: AssemblyVersion("1.1.0.0")]
[assembly: AssemblyFileVersion("1.1.0.0")]

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
        private System.Windows.Forms.Timer autoStartTimer;
        private System.Windows.Forms.Timer folderDialogWatcher;
        private int countdownSeconds = 2;
        private bool autoStartCancelled = false;
        private bool dialogAutoFilled = false;
        private bool uiAutoClickedLoadUnpacked = false;
        private string installDir;
        private List<BrowserTarget> detectedBrowsers = new List<BrowserTarget>();

        public MainForm()
        {
            Text = "SWEEPR Deepblock — Chrome / Edge / Brave Installer";
            Size = new Size(540, 440);
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
                Text = "SWEEPR Deepblock — Browser Extension Setup",
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 13.5F, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(22, 14)
            };

            subtitleLabel = new Label
            {
                Text = "Unpacks & auto-fills Chrome's extension loader for Chrome 137+ / 155+",
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
                Text = "In Chrome 137+, Google requires clicking 'Load unpacked' once on chrome://extensions:\r\n" +
                       "1. Ensure 'Developer mode' (top-right toggle) is ON.\r\n" +
                       "2. Click 'Load unpacked' (top-left button) — this installer will AUTOMATICALLY fill & select the folder for you (or press Ctrl+V then Enter)!",
                ForeColor = Color.FromArgb(30, 41, 59),
                BackColor = Color.FromArgb(236, 253, 245),
                BorderStyle = BorderStyle.FixedSingle,
                Padding = new Padding(10),
                Font = new Font("Segoe UI", 9F, FontStyle.Regular),
                AutoSize = false,
                Size = new Size(476, 86),
                Location = new Point(24, 196)
            };

            launchBrowserBtn = new Button
            {
                Text = "Open Chrome Extensions & Auto-Load SWEEPR Deepblock",
                Location = new Point(24, 294),
                Size = new Size(476, 46),
                BackColor = Color.FromArgb(5, 150, 105),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 10.25F, FontStyle.Bold),
                Enabled = false,
                Cursor = Cursors.Hand
            };
            launchBrowserBtn.FlatAppearance.BorderSize = 0;
            launchBrowserBtn.Click += OnActivateBrowserClick;

            copyPathBtn = new Button
            {
                Text = "Copy Extension Folder Path to Clipboard",
                Location = new Point(24, 348),
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
            statusLabel.Text = "✓ Unpacked & path copied to clipboard!\r\nOpening " + browserName + " Extensions page & watching for 'Load unpacked'...";
            launchBrowserBtn.Text = "Open " + browserName + " Extensions & Auto-Load (" + countdownSeconds + "s)";
            launchBrowserBtn.Enabled = true;
            copyPathBtn.Enabled = true;
            copyPathBtn.Text = "✓ Path Copied: " + installDir;

            // Start watching for the Windows "Select the extension directory" dialog every 120ms
            folderDialogWatcher = new System.Windows.Forms.Timer { Interval = 120 };
            folderDialogWatcher.Tick += OnWatchFolderDialogTick;
            folderDialogWatcher.Start();

            autoStartTimer = new System.Windows.Forms.Timer { Interval = 1000 };
            autoStartTimer.Tick += (s, ev) =>
            {
                if (autoStartCancelled)
                {
                    autoStartTimer.Stop();
                    return;
                }
                countdownSeconds--;
                if (countdownSeconds <= 0)
                {
                    autoStartTimer.Stop();
                    OnActivateBrowserClick(this, EventArgs.Empty);
                }
                else
                {
                    BrowserTarget current = browserSelector.SelectedItem as BrowserTarget;
                    string bName = current != null ? current.Name : browserName;
                    launchBrowserBtn.Text = "Open " + bName + " Extensions & Auto-Load (" + countdownSeconds + "s)";
                }
            };
            autoStartTimer.Start();
        }

        private void OnWatchFolderDialogTick(object sender, EventArgs e)
        {
            if (dialogAutoFilled) return;

            // Look for Chrome/Edge's standard Win32 #32770 folder picker dialog
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
                    SetForegroundWindow(dlgHwnd);
                    Thread.Sleep(80);

                    // Find the Edit control inside the #32770 dialog (either direct or inside DUIViewWndClassName / ComboBoxEx32)
                    IntPtr editHwnd = FindEditControlRecursive(dlgHwnd);
                    if (editHwnd != IntPtr.Zero)
                    {
                        SendMessage(editHwnd, WM_SETTEXT, IntPtr.Zero, installDir);
                        Thread.Sleep(60);
                    }
                    else
                    {
                        SendKeys.SendWait("^v");
                        Thread.Sleep(60);
                    }

                    // Click the "Select Folder" button (ID 1 = IDOK in standard file/folder dialogs) or send Enter
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

                    statusLabel.Text = "🎉 SWEEPR Deepblock folder selected & loaded into your browser!";
                    launchBrowserBtn.Text = "✓ Extension Loaded Successfully!";
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

        private void TryUiAutomationClickLoadUnpacked()
        {
            if (uiAutoClickedLoadUnpacked) return;
            Task.Run(() =>
            {
                for (int attempt = 0; attempt < 12; attempt++)
                {
                    if (dialogAutoFilled || uiAutoClickedLoadUnpacked) return;
                    Thread.Sleep(450);
                    try
                    {
                        AutomationElement root = AutomationElement.RootElement;
                        if (root == null) continue;

                        Condition chromeWinCond = new PropertyCondition(AutomationElement.ClassNameProperty, "Chrome_WidgetWin_1");
                        AutomationElementCollection wins = root.FindAll(TreeScope.Children, chromeWinCond);
                        foreach (AutomationElement win in wins)
                        {
                            string winName = win.Current.Name ?? "";
                            if (winName.IndexOf("Extensions", StringComparison.OrdinalIgnoreCase) < 0 &&
                                winName.IndexOf("Chrome", StringComparison.OrdinalIgnoreCase) < 0 &&
                                winName.IndexOf("Edge", StringComparison.OrdinalIgnoreCase) < 0 &&
                                winName.IndexOf("Brave", StringComparison.OrdinalIgnoreCase) < 0)
                            {
                                continue;
                            }

                            // 1. Ensure Developer Mode toggle is ON if accessible
                            Condition devModeCond = new PropertyCondition(AutomationElement.NameProperty, "Developer mode");
                            AutomationElement devToggle = win.FindFirst(TreeScope.Descendants, devModeCond);
                            if (devToggle != null)
                            {
                                object toggleObj;
                                if (devToggle.TryGetCurrentPattern(TogglePattern.Pattern, out toggleObj))
                                {
                                    TogglePattern tp = (TogglePattern)toggleObj;
                                    if (tp.Current.ToggleState == ToggleState.Off)
                                    {
                                        tp.Toggle();
                                        Thread.Sleep(250);
                                    }
                                }
                            }

                            // 2. Find and Invoke "Load unpacked" button
                            Condition loadUnpackedCond = new PropertyCondition(AutomationElement.NameProperty, "Load unpacked");
                            AutomationElement loadBtn = win.FindFirst(TreeScope.Descendants, loadUnpackedCond);
                            if (loadBtn != null)
                            {
                                object invObj;
                                if (loadBtn.TryGetCurrentPattern(InvokePattern.Pattern, out invObj))
                                {
                                    uiAutoClickedLoadUnpacked = true;
                                    ((InvokePattern)invObj).Invoke();
                                    return;
                                }
                            }
                        }
                    }
                    catch { }
                }
            });
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
                foreach (BrowserTarget bt in detectedBrowsers)
                {
                    EnableDeveloperModeInAllProfiles(bt.UserDataDir);
                }
            }
            catch (Exception ex)
            {
                Invoke((Action)(() =>
                {
                    statusLabel.Text = "Setup notice: " + ex.Message;
                }));
            }
        }

        private void EnableDeveloperModeInAllProfiles(string userDataDir)
        {
            try
            {
                if (string.IsNullOrEmpty(userDataDir) || !Directory.Exists(userDataDir)) return;
                List<string> profileDirs = new List<string>();
                string defaultDir = Path.Combine(userDataDir, "Default");
                if (Directory.Exists(defaultDir)) profileDirs.Add(defaultDir);

                foreach (string dir in Directory.GetDirectories(userDataDir, "Profile *"))
                {
                    profileDirs.Add(dir);
                }

                foreach (string pDir in profileDirs)
                {
                    string prefPath = Path.Combine(pDir, "Preferences");
                    if (!File.Exists(prefPath)) continue;
                    try
                    {
                        string json = File.ReadAllText(prefPath);
                        if (json.Contains("\"developer_mode\":false"))
                        {
                            json = json.Replace("\"developer_mode\":false", "\"developer_mode\":true");
                            File.WriteAllText(prefPath, json);
                        }
                    }
                    catch { }
                }
            }
            catch { }
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

        private void OnActivateBrowserClick(object sender, EventArgs e)
        {
            autoStartCancelled = true;
            if (autoStartTimer != null) autoStartTimer.Stop();
            dialogAutoFilled = false;

            try
            {
                Clipboard.SetText(installDir);
            }
            catch { }

            BrowserTarget target = browserSelector.SelectedItem as BrowserTarget;
            if (target == null && detectedBrowsers.Count > 0)
            {
                target = detectedBrowsers[0];
            }

            if (target == null)
            {
                Process.Start("https://sweeprdeepblock.com/login");
                return;
            }

            // Position this helper window at the bottom-right so it stays visible on top of Chrome without blocking the top-left "Load unpacked" button
            try
            {
                Rectangle wa = Screen.PrimaryScreen.WorkingArea;
                Location = new Point(Math.Max(20, wa.Right - Width - 24), Math.Max(20, wa.Bottom - Height - 24));
            }
            catch { }

            // Open chrome://extensions directly in the user's running browser (no disruptive browser kill needed!)
            // Also pass --force-renderer-accessibility so UIAutomation can click "Load unpacked" if Chrome is starting fresh.
            string args = string.Format(
                "--force-renderer-accessibility --load-extension=\"{0}\" \"{1}\"",
                installDir,
                target.ExtensionsUrl
            );

            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = target.ExePath,
                    Arguments = args,
                    UseShellExecute = true
                });
            }
            catch { }

            statusLabel.Text = "👉 In " + target.Name + ": toggle 'Developer mode' ON (top-right) & click 'Load unpacked' (top-left) — this installer will auto-select the folder!";
            launchBrowserBtn.Text = "↻ Re-Open " + target.Name + " Extensions Page";

            TryUiAutomationClickLoadUnpacked();
        }

        private void OnCopyPathClick(object sender, EventArgs e)
        {
            autoStartCancelled = true;
            if (autoStartTimer != null) autoStartTimer.Stop();

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
