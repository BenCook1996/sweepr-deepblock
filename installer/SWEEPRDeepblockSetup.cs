using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

[assembly: AssemblyTitle("SWEEPR Deepblock 1-Click Browser Installer")]
[assembly: AssemblyDescription("Automatically installs SWEEPR Deepblock into Chrome, Edge, Brave, and Opera.")]
[assembly: AssemblyConfiguration("Release")]
[assembly: AssemblyCompany("SWEEPR Technologies")]
[assembly: AssemblyProduct("SWEEPR Deepblock")]
[assembly: AssemblyCopyright("Copyright (c) 2026 SWEEPR Technologies")]
[assembly: AssemblyTrademark("SWEEPR")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace SweeprDeepblockInstaller
{
    public sealed class BrowserTarget
    {
        public string Id;
        public string Name;
        public string ExePath;
        public string UserDataDir;
        public string ProcessName;
        public string ExtUrl;
    }

    public sealed class InstallerForm : Form
    {
        private readonly TextBox _licenseInput;
        private readonly Button _installBtn;
        private readonly Label _statusLabel;
        private readonly Label _detectedLabel;
        private readonly List<BrowserTarget> _browsers;

        public InstallerForm(List<BrowserTarget> browsers, string initialKey)
        {
            _browsers = browsers;
            Text = "SWEEPR Deepblock — 1-Click Browser Setup";
            Size = new Size(500, 390);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(248, 250, 252);
            Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

            Panel headerPanel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 92,
                BackColor = Color.FromArgb(6, 78, 59)
            };

            Label badgeLabel = new Label
            {
                Text = "SWEEPR DEEPBLOCK • AUTOMATIC BROWSER INSTALLER",
                ForeColor = Color.FromArgb(167, 243, 208),
                Font = new Font("Segoe UI", 8f, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(24, 18)
            };

            Label titleLabel = new Label
            {
                Text = "1-Click Browser Extension Setup",
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 15f, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(22, 38)
            };

            headerPanel.Controls.Add(badgeLabel);
            headerPanel.Controls.Add(titleLabel);
            Controls.Add(headerPanel);

            string browserNames = browsers.Count > 0
                ? string.Join(", ", browsers.ConvertAll(b => b.Name).ToArray())
                : "Google Chrome / Microsoft Edge";

            _detectedLabel = new Label
            {
                Text = "Detected Browsers: " + browserNames + "\nNo manual unzipping or folder uploading required.",
                ForeColor = Color.FromArgb(31, 41, 55),
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                Location = new Point(24, 108),
                Size = new Size(440, 42)
            };
            Controls.Add(_detectedLabel);

            Label keyPrompt = new Label
            {
                Text = "Have a 6-Digit Activation Code or Pro License Key? (Optional):",
                ForeColor = Color.FromArgb(6, 95, 70),
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Location = new Point(24, 160),
                AutoSize = true
            };
            Controls.Add(keyPrompt);

            _licenseInput = new TextBox
            {
                Location = new Point(24, 184),
                Size = new Size(436, 28),
                Font = new Font("Segoe UI", 10.5f, FontStyle.Regular),
                Text = initialKey ?? ""
            };
            Controls.Add(_licenseInput);

            Label keyHint = new Label
            {
                Text = "Leave blank to install the free extension first, or enter your code to unlock Pro automatically.",
                ForeColor = Color.FromArgb(107, 114, 128),
                Font = new Font("Segoe UI", 8.25f, FontStyle.Regular),
                Location = new Point(24, 214),
                Size = new Size(440, 20)
            };
            Controls.Add(keyHint);

            _installBtn = new Button
            {
                Text = "⚡ Install to Browser & Launch Automatically",
                Location = new Point(24, 246),
                Size = new Size(436, 46),
                BackColor = Color.FromArgb(5, 150, 105),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 11f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _installBtn.FlatAppearance.BorderSize = 0;
            _installBtn.Click += OnInstallClick;
            Controls.Add(_installBtn);

            _statusLabel = new Label
            {
                Text = "Ready to install into your browser.",
                ForeColor = Color.FromArgb(75, 85, 99),
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Location = new Point(24, 304),
                Size = new Size(436, 40)
            };
            Controls.Add(_statusLabel);
        }

        private void OnInstallClick(object sender, EventArgs e)
        {
            _installBtn.Enabled = false;
            _installBtn.Text = "Installing SWEEPR Deepblock...";
            _statusLabel.ForeColor = Color.FromArgb(5, 150, 105);
            _statusLabel.Text = "Unpacking extension and configuring browser...";
            Application.DoEvents();

            try
            {
                string key = (_licenseInput.Text ?? "").Trim();
                Program.RunAutomatedInstall(_browsers, key);
                _installBtn.Text = "✓ Installed & Launched!";
                _statusLabel.Text = "✓ SWEEPR Deepblock is now installed! Check your opened browser window.";
                Timer closeTimer = new Timer { Interval = 2200 };
                closeTimer.Tick += (s, args) =>
                {
                    closeTimer.Stop();
                    Close();
                };
                closeTimer.Start();
            }
            catch (Exception ex)
            {
                _installBtn.Enabled = true;
                _installBtn.Text = "⚡ Retry Automatic Install";
                _statusLabel.ForeColor = Color.FromArgb(185, 28, 28);
                _statusLabel.Text = "Setup error: " + ex.Message;
            }
        }
    }

    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            string cliKey = "";
            bool silent = false;
            if (args != null)
            {
                foreach (string a in args)
                {
                    if (string.Equals(a, "--silent", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(a, "/S", StringComparison.OrdinalIgnoreCase))
                    {
                        silent = true;
                    }
                    else if (a.StartsWith("--key=", StringComparison.OrdinalIgnoreCase))
                    {
                        cliKey = a.Substring(6).Trim();
                    }
                }
            }

            List<BrowserTarget> browsers = DetectInstalledBrowsers();
            if (silent)
            {
                RunAutomatedInstall(browsers, cliKey);
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm(browsers, cliKey));
        }

        internal static List<BrowserTarget> DetectInstalledBrowsers()
        {
            List<BrowserTarget> list = new List<BrowserTarget>();
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string progFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string progFiles86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);

            AddIfPresent(list, "chrome", "Google Chrome", "chrome", "chrome://extensions",
                Path.Combine(localAppData, @"Google\Chrome\User Data"),
                Path.Combine(progFiles, @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(progFiles86, @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(localAppData, @"Google\Chrome\Application\chrome.exe"));

            AddIfPresent(list, "edge", "Microsoft Edge", "msedge", "edge://extensions",
                Path.Combine(localAppData, @"Microsoft\Edge\User Data"),
                Path.Combine(progFiles86, @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(progFiles, @"Microsoft\Edge\Application\msedge.exe"));

            AddIfPresent(list, "brave", "Brave Browser", "brave", "brave://extensions",
                Path.Combine(localAppData, @"BraveSoftware\Brave-Browser\User Data"),
                Path.Combine(progFiles, @"BraveSoftware\Brave-Browser\Application\brave.exe"),
                Path.Combine(progFiles86, @"BraveSoftware\Brave-Browser\Application\brave.exe"),
                Path.Combine(localAppData, @"BraveSoftware\Brave-Browser\Application\brave.exe"));

            return list;
        }

        private static void AddIfPresent(
            List<BrowserTarget> list,
            string id,
            string name,
            string procName,
            string extUrl,
            string userDataDir,
            params string[] candidatePaths)
        {
            foreach (string p in candidatePaths)
            {
                if (!string.IsNullOrEmpty(p) && File.Exists(p))
                {
                    list.Add(new BrowserTarget
                    {
                        Id = id,
                        Name = name,
                        ExePath = p,
                        UserDataDir = userDataDir,
                        ProcessName = procName,
                        ExtUrl = extUrl
                    });
                    return;
                }
            }
        }

        internal static void RunAutomatedInstall(List<BrowserTarget> browsers, string licenseKey)
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string installRoot = Path.Combine(localAppData, @"SWEEPR\Deepblock");
            string extDir = Path.Combine(installRoot, "Extension");
            string zipPath = Path.Combine(installRoot, "sweepr-deepblock-extension.zip");

            Directory.CreateDirectory(installRoot);

            using (Stream resStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("sweepr-deepblock-extension.zip"))
            {
                if (resStream == null)
                {
                    throw new InvalidOperationException("Embedded extension package not found.");
                }
                using (FileStream fs = new FileStream(zipPath, FileMode.Create, FileAccess.Write))
                {
                    resStream.CopyTo(fs);
                }
            }

            if (Directory.Exists(extDir))
            {
                try { Directory.Delete(extDir, true); } catch { }
            }
            Directory.CreateDirectory(extDir);
            ZipFile.ExtractToDirectory(zipPath, extDir);

            if (!string.IsNullOrEmpty(licenseKey) && licenseKey.Length >= 6)
            {
                string safeKey = licenseKey.Replace("\\", "").Replace("\"", "");
                string json = "{\"licenseKey\":\"" + safeKey + "\",\"activation_code\":\"" + safeKey + "\"}";
                File.WriteAllText(Path.Combine(extDir, "preactivated-license.json"), json, Encoding.UTF8);
            }

            foreach (BrowserTarget b in browsers)
            {
                EnableDeveloperModeInPreferences(b.UserDataDir);
            }

            try
            {
                Clipboard.SetText(extDir);
            }
            catch { }

            if (browsers.Count > 0)
            {
                BrowserTarget primary = browsers[0];
                foreach (BrowserTarget b in browsers)
                {
                    if (b.Id == "chrome") { primary = b; break; }
                }

                // Gracefully restart primary browser with --restore-last-session & --load-extension so it loads automatically
                try
                {
                    Process[] running = Process.GetProcessesByName(primary.ProcessName);
                    if (running != null && running.Length > 0)
                    {
                        foreach (Process p in running)
                        {
                            try
                            {
                                if (p.MainWindowHandle != IntPtr.Zero) p.CloseMainWindow();
                            }
                            catch { }
                        }
                        System.Threading.Thread.Sleep(900);
                        foreach (Process p in Process.GetProcessesByName(primary.ProcessName))
                        {
                            try { p.Kill(); } catch { }
                        }
                        System.Threading.Thread.Sleep(500);
                    }
                }
                catch { }

                string args = string.Format(
                    "--restore-last-session --load-extension=\"{0}\" \"https://sweeprdeepblock.com/download?installed=1\"",
                    extDir);
                Process.Start(new ProcessStartInfo
                {
                    FileName = primary.ExePath,
                    Arguments = args,
                    UseShellExecute = true
                });
            }
        }

        private static void EnableDeveloperModeInPreferences(string userDataDir)
        {
            try
            {
                if (string.IsNullOrEmpty(userDataDir) || !Directory.Exists(userDataDir)) return;
                string prefPath = Path.Combine(userDataDir, @"Default\Preferences");
                if (!File.Exists(prefPath)) return;
                string content = File.ReadAllText(prefPath, Encoding.UTF8);
                if (content.Contains("\"developer_mode\":false"))
                {
                    content = content.Replace("\"developer_mode\":false", "\"developer_mode\":true");
                    File.WriteAllText(prefPath, content, Encoding.UTF8);
                }
            }
            catch { }
        }
    }
}
