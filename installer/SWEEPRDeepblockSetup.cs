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
using Microsoft.Win32;

[assembly: AssemblyTitle("SWEEPR Deepblock 1-Click Installer")]
[assembly: AssemblyDescription("SWEEPR Deepblock Automated Browser Extension Setup for Chrome, Edge, and Brave")]
[assembly: AssemblyConfiguration("")]
[assembly: AssemblyCompany("SWEEPR Technologies")]
[assembly: AssemblyProduct("SWEEPR Deepblock")]
[assembly: AssemblyCopyright("Copyright (c) 2026 SWEEPR Technologies")]
[assembly: AssemblyTrademark("SWEEPR")]
[assembly: AssemblyCulture("")]
[assembly: ComVisible(false)]
[assembly: AssemblyVersion("1.3.0.0")]
[assembly: AssemblyFileVersion("1.3.0.0")]

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
        public string ProgId;

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
        private Label stepsBox;
        private ComboBox browserSelector;
        private ProgressBar progressBar;
        private Button launchBrowserBtn;
        private Button copyPathBtn;
        private bool isRunningSequence = false;
        private string installDir;
        private List<BrowserTarget> detectedBrowsers = new List<BrowserTarget>();

        public MainForm()
        {
            Text = "SWEEPR Deepblock — 1-Click Browser Installer (v1.3)";
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
                Text = "Installs & activates SWEEPR Deepblock automatically in your browser",
                ForeColor = Color.FromArgb(167, 243, 208),
                Font = new Font("Segoe UI", 9.25F, FontStyle.Regular),
                AutoSize = true,
                Location = new Point(24, 44)
            };

            headerPanel.Controls.Add(titleLabel);
            headerPanel.Controls.Add(subtitleLabel);

            statusLabel = new Label
            {
                Text = "Unpacking extension files & configuring browser...",
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
            browserSelector.SelectedIndexChanged += (s, ev) =>
            {
                BrowserTarget sel = browserSelector.SelectedItem as BrowserTarget;
                if (sel != null && !isRunningSequence)
                {
                    launchBrowserBtn.Text = "✓ Activate & Restart " + sel.Name + " Now";
                }
            };

            stepsBox = new Label
            {
                Text = "How 1-Click Activation works:\r\n" +
                       "1. Click the green button below to restart your browser with SWEEPR Deepblock loaded.\r\n" +
                       "2. Your browser will open directly to Extensions with SWEEPR Deepblock installed and active — no folder dialogs required!",
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
                Text = "✓ Activate & Restart Google Chrome Now",
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
            statusLabel.Text = "✓ Ready! Click the green button below to restart " + browserName + " with SWEEPR Deepblock active.";
            launchBrowserBtn.Text = "✓ Activate & Restart " + browserName + " Now";
            launchBrowserBtn.Enabled = true;
            copyPathBtn.Enabled = true;
            copyPathBtn.Text = "✓ Installed at: " + installDir;
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
                    string extPaths = BuildExtensionPathsList(bt.UserDataDir);
                    string flags = BuildBrowserFlags(extPaths);
                    UpdateBrowserShortcuts(bt.ExePath, flags);
                    UpdateUserProtocolHandler(bt.ProgId, bt.ExePath, flags);
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

        private string BuildExtensionPathsList(string userDataDir)
        {
            List<string> paths = new List<string>();
            HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            // Preserve any existing user-installed extensions in the profile's Extensions directory
            HashSet<string> builtInIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "ghbmnnjooekpmoecnnnilnnbdlolhkhi",
                "nmmhkkegccagdldgiimedpiccmgmieda",
                "pkedcjkdefgpdelpbcmbmeomcjbeemfm",
                "mhjfbmdgcfjbbpaeojofohoefgiehjai",
                "nkeimhogjdpnpccoofpliimaahmaaome",
                "fignfifoniblkonapihmkfakmlgkbkcf",
                "admccjkmockfdflocgggjfgdacdodkdf"
            };

            try
            {
                if (!string.IsNullOrEmpty(userDataDir) && Directory.Exists(userDataDir))
                {
                    List<string> profiles = new List<string>();
                    string defDir = Path.Combine(userDataDir, "Default");
                    if (Directory.Exists(defDir)) profiles.Add(defDir);
                    foreach (string d in Directory.GetDirectories(userDataDir, "Profile *"))
                    {
                        profiles.Add(d);
                    }

                    foreach (string prof in profiles)
                    {
                        string extRoot = Path.Combine(prof, "Extensions");
                        if (!Directory.Exists(extRoot)) continue;

                        foreach (string idDir in Directory.GetDirectories(extRoot))
                        {
                            string extId = Path.GetFileName(idDir);
                            if (builtInIds.Contains(extId)) continue;

                            string[] verDirs = Directory.GetDirectories(idDir);
                            if (verDirs.Length > 0)
                            {
                                Array.Sort(verDirs, StringComparer.OrdinalIgnoreCase);
                                string latestVer = verDirs[verDirs.Length - 1];
                                if (File.Exists(Path.Combine(latestVer, "manifest.json")) && !seen.Contains(latestVer))
                                {
                                    seen.Add(latestVer);
                                    paths.Add(latestVer);
                                }
                            }
                        }
                    }
                }
            }
            catch { }

            if (!seen.Contains(installDir))
            {
                paths.Add(installDir);
            }

            return string.Join(",", paths.ToArray());
        }

        private string BuildBrowserFlags(string extPaths)
        {
            return "--disable-features=DisableLoadExtensionCommandLineSwitch,DisableDisableExtensionsExceptCommandLineSwitch " +
                   "--load-extension=\"" + extPaths + "\" " +
                   "--disable-extensions-except=\"" + extPaths + "\"";
        }

        private void UpdateBrowserShortcuts(string targetExePath, string flagsToInject)
        {
            try
            {
                string targetExeName = Path.GetFileName(targetExePath);
                List<string> folders = new List<string>
                {
                    Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory),
                    Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),
                    Environment.GetFolderPath(Environment.SpecialFolder.Programs),
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu),
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Microsoft\\Internet Explorer\\Quick Launch"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Microsoft\\Internet Explorer\\Quick Launch\\User Pinned\\TaskBar")
                };

                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType == null) return;
                object shell = Activator.CreateInstance(shellType);

                foreach (string dir in folders)
                {
                    if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) continue;

                    string[] lnkFiles = new string[0];
                    try
                    {
                        lnkFiles = Directory.GetFiles(dir, "*.lnk", SearchOption.TopDirectoryOnly);
                    }
                    catch { continue; }

                    foreach (string lnk in lnkFiles)
                    {
                        try
                        {
                            object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { lnk });
                            if (shortcut == null) continue;

                            string tPath = shortcut.GetType().InvokeMember("TargetPath", BindingFlags.GetProperty, null, shortcut, null) as string;
                            if (string.IsNullOrEmpty(tPath)) continue;

                            if (string.Equals(Path.GetFileName(tPath), targetExeName, StringComparison.OrdinalIgnoreCase))
                            {
                                shortcut.GetType().InvokeMember("Arguments", BindingFlags.SetProperty, null, shortcut, new object[] { flagsToInject });
                                shortcut.GetType().InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
                            }
                        }
                        catch { }
                    }
                }
            }
            catch { }
        }

        private void UpdateUserProtocolHandler(string progId, string exePath, string flagsToInject)
        {
            try
            {
                if (string.IsNullOrEmpty(progId)) return;
                string keyPath = "Software\\Classes\\" + progId + "\\shell\\open\\command";
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(keyPath))
                {
                    if (key != null)
                    {
                        string cmd = "\"" + exePath + "\" " + flagsToInject + " -- \"%1\"";
                        key.SetValue("", cmd, RegistryValueKind.String);
                    }
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
                        ExtensionsUrl = "chrome://extensions",
                        ProgId = "ChromeHTML"
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
                        ExtensionsUrl = "edge://extensions",
                        ProgId = "MSEdgeHTM"
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
                        ExtensionsUrl = "brave://extensions",
                        ProgId = "BraveHTML"
                    });
                    break;
                }
            }
        }

        private async void OnActivateBrowserClick(object sender, EventArgs e)
        {
            if (isRunningSequence) return;
            isRunningSequence = true;

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
            launchBrowserBtn.Text = "Restarting " + target.Name + "...";
            statusLabel.Text = "Closing existing " + target.Name + " processes so the extension can load...";

            string extPaths = BuildExtensionPathsList(target.UserDataDir);
            string flags = BuildBrowserFlags(extPaths);

            await Task.Run(() =>
            {
                // 1. Ask visible browser windows to close cleanly first
                try
                {
                    foreach (Process p in Process.GetProcessesByName(target.ProcessName))
                    {
                        try
                        {
                            if (p.MainWindowHandle != IntPtr.Zero)
                            {
                                p.CloseMainWindow();
                            }
                        }
                        catch { }
                    }
                }
                catch { }

                Thread.Sleep(700);

                // 2. Ensure ALL browser processes (including background/renderer processes) are completely terminated
                // so the new browser instance starts fresh with our extension flags instead of handing off via IPC.
                for (int attempt = 0; attempt < 15; attempt++)
                {
                    Process[] remaining = Process.GetProcessesByName(target.ProcessName);
                    if (remaining.Length == 0) break;

                    foreach (Process p in remaining)
                    {
                        try
                        {
                            p.Kill();
                            p.WaitForExit(1000);
                        }
                        catch { }
                    }

                    Thread.Sleep(250);
                }

                Thread.Sleep(400);

                // 3. Re-ensure shortcuts & protocol handler have the flags
                UpdateBrowserShortcuts(target.ExePath, flags);
                UpdateUserProtocolHandler(target.ProgId, target.ExePath, flags);

                // 4. Launch browser directly onto chrome://extensions (without --restore-last-session so it never re-triggers /download?install=1)
                string launchArgs = "--no-first-run --no-default-browser-check " + flags + " " + target.ExtensionsUrl;
                try
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = target.ExePath,
                        Arguments = launchArgs,
                        UseShellExecute = false
                    });
                }
                catch
                {
                    try
                    {
                        Process.Start(target.ExePath, launchArgs);
                    }
                    catch { }
                }
            });

            statusLabel.Text = "🎉 " + target.Name + " restarted! SWEEPR Deepblock is now installed & visible in " + target.ExtensionsUrl + ".";
            launchBrowserBtn.Text = "✓ Installed & Active in " + target.Name + "!";
            launchBrowserBtn.Enabled = true;
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
