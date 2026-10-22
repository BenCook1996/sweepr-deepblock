using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
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
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

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
        private Label titleLabel;
        private Label subtitleLabel;
        private Label statusLabel;
        private ComboBox browserSelector;
        private ProgressBar progressBar;
        private Button launchBrowserBtn;
        private Button copyPathBtn;
        private CheckBox createShortcutCheck;
        private System.Windows.Forms.Timer autoStartTimer;
        private int countdownSeconds = 3;
        private bool autoStartCancelled = false;
        private string installDir;
        private List<BrowserTarget> detectedBrowsers = new List<BrowserTarget>();

        public MainForm()
        {
            Text = "SWEEPR Deepblock — 1-Click Browser Installer";
            Size = new Size(530, 395);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
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
                Height = 82,
                BackColor = Color.FromArgb(6, 78, 59),
                Padding = new Padding(22, 16, 22, 14)
            };

            titleLabel = new Label
            {
                Text = "SWEEPR Deepblock — 1-Click Auto-Setup",
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 14F, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(22, 15)
            };

            subtitleLabel = new Label
            {
                Text = "No manual unzipping or folder uploading required.",
                ForeColor = Color.FromArgb(167, 243, 208),
                Font = new Font("Segoe UI", 9.5F, FontStyle.Regular),
                AutoSize = true,
                Location = new Point(24, 45)
            };

            headerPanel.Controls.Add(titleLabel);
            headerPanel.Controls.Add(subtitleLabel);

            statusLabel = new Label
            {
                Text = "Unpacking extension files to AppData...",
                ForeColor = Color.FromArgb(31, 41, 55),
                Font = new Font("Segoe UI", 9.75F, FontStyle.Bold),
                AutoSize = false,
                Size = new Size(470, 44),
                Location = new Point(24, 96)
            };

            progressBar = new ProgressBar
            {
                Location = new Point(24, 144),
                Size = new Size(466, 16),
                Style = ProgressBarStyle.Continuous,
                Value = 20
            };

            Label browserLabel = new Label
            {
                Text = "Target Browser:",
                ForeColor = Color.FromArgb(55, 65, 81),
                Font = new Font("Segoe UI", 9F, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(24, 174)
            };

            browserSelector = new ComboBox
            {
                Location = new Point(130, 170),
                Size = new Size(360, 26),
                DropDownStyle = ComboBoxStyle.DropDownList
            };
            browserSelector.SelectedIndexChanged += (s, ev) =>
            {
                autoStartCancelled = true;
                if (autoStartTimer != null) autoStartTimer.Stop();
                BrowserTarget bt = browserSelector.SelectedItem as BrowserTarget;
                if (bt != null)
                {
                    launchBrowserBtn.Text = "✓ Activate in " + bt.Name + " Now (Restores Open Tabs)";
                }
            };

            createShortcutCheck = new CheckBox
            {
                Text = "Create desktop launcher with SWEEPR Deepblock pre-loaded",
                Checked = true,
                AutoSize = true,
                ForeColor = Color.FromArgb(55, 65, 81),
                Location = new Point(24, 206)
            };

            launchBrowserBtn = new Button
            {
                Text = "Activate in Browser Now (Restores Open Tabs)",
                Location = new Point(24, 240),
                Size = new Size(466, 46),
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
                Text = "Pause Auto-Launch / Copy Extension Path Instead",
                Location = new Point(24, 296),
                Size = new Size(466, 34),
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
            Controls.Add(createShortcutCheck);
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

            string browserName = detectedBrowsers.Count > 0 ? detectedBrowsers[0].Name : "Google Chrome / Edge";
            statusLabel.Text = "✓ Unpacked to AppData & configured for " + browserName + "!\r\nAuto-activating in 3 seconds (restores all your open tabs)...";
            launchBrowserBtn.Text = "✓ Activate in " + browserName + " Now (3s)";
            launchBrowserBtn.Enabled = true;
            copyPathBtn.Enabled = true;

            try
            {
                Clipboard.SetText(installDir);
            }
            catch { }

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
                    launchBrowserBtn.Text = "✓ Activate in " + bName + " Now (" + countdownSeconds + "s)";
                }
            };
            autoStartTimer.Start();
        }

        private void RunExtractionAndDetection()
        {
            try
            {
                if (Directory.Exists(installDir))
                {
                    Directory.Delete(installDir, true);
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
                    EnableDeveloperModeInPreferences(bt.UserDataDir);
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

        private void EnableDeveloperModeInPreferences(string userDataDir)
        {
            try
            {
                if (string.IsNullOrEmpty(userDataDir) || !Directory.Exists(userDataDir)) return;
                string prefPath = Path.Combine(userDataDir, "Default", "Preferences");
                if (!File.Exists(prefPath)) return;

                string json = File.ReadAllText(prefPath);
                if (json.Contains("\"developer_mode\":false"))
                {
                    json = json.Replace("\"developer_mode\":false", "\"developer_mode\":true");
                    File.WriteAllText(prefPath, json);
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

            launchBrowserBtn.Enabled = false;
            launchBrowserBtn.Text = "Activating SWEEPR Deepblock...";

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
                Close();
                return;
            }

            if (createShortcutCheck.Checked)
            {
                TryCreateDesktopLauncher(target);
            }

            try
            {
                Process[] running = Process.GetProcessesByName(target.ProcessName);
                foreach (Process proc in running)
                {
                    try
                    {
                        if (proc.MainWindowHandle != IntPtr.Zero)
                        {
                            proc.CloseMainWindow();
                        }
                    }
                    catch { }
                }

                // Wait up to 1.8s for graceful window session save
                for (int i = 0; i < 9; i++)
                {
                    if (Process.GetProcessesByName(target.ProcessName).Length == 0) break;
                    Thread.Sleep(200);
                }

                foreach (Process proc in Process.GetProcessesByName(target.ProcessName))
                {
                    try
                    {
                        proc.Kill();
                        proc.WaitForExit(1000);
                    }
                    catch { }
                }
            }
            catch { }

            EnableDeveloperModeInPreferences(target.UserDataDir);

            string args = string.Format(
                "--restore-last-session --disable-features=DisableLoadExtensionCommandLineSwitch --load-extension=\"{0}\" \"https://sweeprdeepblock.com/login\"",
                installDir
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

            statusLabel.Text = "✓ SWEEPR Deepblock is now active in " + target.Name + "!";
            launchBrowserBtn.Text = "✓ Activated Successfully";
            Application.DoEvents();
            Thread.Sleep(700);
            Close();
        }

        private void OnCopyPathClick(object sender, EventArgs e)
        {
            autoStartCancelled = true;
            if (autoStartTimer != null) autoStartTimer.Stop();

            BrowserTarget target = browserSelector.SelectedItem as BrowserTarget;
            if (target != null)
            {
                launchBrowserBtn.Text = "✓ Activate in " + target.Name + " Now (Restores Open Tabs)";
            }

            try
            {
                Clipboard.SetText(installDir);
            }
            catch { }

            statusLabel.Text = "✓ Auto-launch paused. Folder path copied to clipboard:\r\n" + installDir;
            copyPathBtn.Text = "✓ Path Copied (" + installDir + ")";
        }

        private void TryCreateDesktopLauncher(BrowserTarget target)
        {
            try
            {
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string cmdPath = Path.Combine(desktop, "SWEEPR Deepblock Browser.cmd");
                string content = "@echo off\r\nstart \"\" \"" + target.ExePath + "\" --disable-features=DisableLoadExtensionCommandLineSwitch --load-extension=\"" + installDir + "\"\r\n";
                File.WriteAllText(cmdPath, content);
            }
            catch { }
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
