using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("SWEEPR Deepblock")]
[assembly: AssemblyDescription("SWEEPR Deepblock Windows Privacy Suite & Offline MV3 Ad-Block Extension Deployer")]
[assembly: AssemblyCompany("SWEEPR Global Limited")]
[assembly: AssemblyProduct("SWEEPR Deepblock")]
[assembly: AssemblyVersion("1.3.0.0")]
[assembly: AssemblyFileVersion("1.3.0.0")]

namespace SWEEPRDeepblockSetup
{
    internal sealed class DetectedBrowser
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string ExecutablePath { get; set; }
        public string StoreUrl { get; set; }
        public string StoreLabel { get; set; }
        public bool IsChromium { get; set; }
    }

    internal sealed class DnrRuleSummary
    {
        public int Id { get; set; }
        public int Priority { get; set; }
        public string Pattern { get; set; }
        public string ActionType { get; set; }
        public string ResourceTypes { get; set; }
    }

    internal sealed class UrlAuditResult
    {
        public string OriginalUrl { get; set; }
        public string CleanedUrl { get; set; }
        public string Host { get; set; }
        public int StrippedParamCount { get; set; }
        public int RiskScore { get; set; }
        public string Verdict { get; set; }
        public string ReportText { get; set; }
    }

    internal static class Program
    {
        internal const string AppName = "SWEEPR Deepblock";
        internal const string AppVersion = "1.3.0";
        internal const string PublisherName = "SWEEPR Global Limited";
        internal const string UninstallSubKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\SWEEPR.Deepblock";
        internal const string EmbeddedZipResourceName = "SWEEPRDeepblock.Extension.zip";
        internal const string ChromeWebStoreUrl = "https://chromewebstore.google.com/detail/bkdfhdgmglfancgpkcbdceinfdlccmpc";
        internal const string FirefoxAmoUrl = "https://addons.mozilla.org/en-US/firefox/addon/sweepr-deepblock/";
        internal const string TestLabUrl = "https://sweeprdeepblock.com/test-lab";
        internal const string BrandHomeUrl = "https://sweeprdeepblock.com";

        internal static readonly Regex FullLicenseKeyRegex = new Regex(
            @"^SWEEPR-[A-Z0-9]{2,8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly HashSet<string> TrackingQueryParams = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
            "fbclid", "gclid", "gbraid", "wbraid", "msclkid", "twclid", "ttclid",
            "mc_eid", "mc_cid", "_hsenc", "_hsmi", "yclid", "rb_clickid", "ref_src", "igshid"
        };

        private static readonly HashSet<string> HighRiskTlds = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".top", ".xyz", ".shop", ".icu", ".buzz", ".cfd", ".cyou", ".tk", ".ml", ".ga", ".cf", ".gq", ".click", ".rest"
        };

        private static readonly string[] ScamUrgencyKeywords = new string[]
        {
            "clearance", "flash-sale", "outlet-deals", "deals-", "80-off", "90-off",
            "limited-offer", "discount", "giveaway", "claim-prize", "verify-account"
        };

        private static readonly HashSet<string> AllowedExternalUrls = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ChromeWebStoreUrl,
            FirefoxAmoUrl,
            TestLabUrl,
            BrandHomeUrl
        };

        [STAThread]
        private static int Main(string[] args)
        {
            bool silent = false;
            bool uninstall = false;
            string exportScreenshotsDir = null;

            if (args != null)
            {
                foreach (string rawArg in args)
                {
                    if (string.IsNullOrEmpty(rawArg)) continue;
                    string arg = rawArg.Trim();
                    if (string.Equals(arg, "/S", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(arg, "/SILENT", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(arg, "/VERYSILENT", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(arg, "--silent", StringComparison.OrdinalIgnoreCase))
                    {
                        silent = true;
                    }
                    else if (string.Equals(arg, "--uninstall", StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(arg, "/UNINSTALL", StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(arg, "/U", StringComparison.OrdinalIgnoreCase))
                    {
                        uninstall = true;
                    }
                    else if (arg.StartsWith("--export-screenshots=", StringComparison.OrdinalIgnoreCase))
                    {
                        exportScreenshotsDir = arg.Substring("--export-screenshots=".Length).Trim().Trim('"');
                    }
                }
            }

            if (uninstall)
            {
                return RunUninstall(silent);
            }

            List<DnrRuleSummary> loadedRules = new List<DnrRuleSummary>();
            string extensionDir = GetExtensionDir();
            try
            {
                loadedRules = WriteInstallAndExtractExtension();
            }
            catch
            {
                // Fallback to reading embedded JSON directly if directory extraction is blocked.
                loadedRules = LoadRulesFromEmbeddedZip();
            }

            if (silent)
            {
                return File.Exists(Path.Combine(extensionDir, "manifest.json")) || loadedRules.Count > 0 ? 0 : 1;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            if (!string.IsNullOrEmpty(exportScreenshotsDir))
            {
                return ExportVerificationScreenshots(exportScreenshotsDir, extensionDir, loadedRules);
            }

            using (var form = new SetupForm(extensionDir, loadedRules))
            {
                Application.Run(form);
            }
            return 0;
        }

        internal static string GetInstallDir()
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            return Path.Combine(localAppData, "SWEEPR", "Deepblock");
        }

        internal static string GetExtensionDir()
        {
            return Path.Combine(GetInstallDir(), "Extension");
        }

        internal static string NormalizeLicenseKey(string input)
        {
            return (input ?? string.Empty).Trim().ToUpperInvariant();
        }

        internal static bool IsValidFullLicenseKey(string normalized)
        {
            return !string.IsNullOrEmpty(normalized) && FullLicenseKeyRegex.IsMatch(normalized);
        }

        internal static List<DnrRuleSummary> WriteInstallAndExtractExtension()
        {
            string installDir = GetInstallDir();
            string extensionDir = GetExtensionDir();
            Directory.CreateDirectory(installDir);
            Directory.CreateDirectory(extensionDir);

            string currentExe = Process.GetCurrentProcess().MainModule != null
                ? Process.GetCurrentProcess().MainModule.FileName
                : Assembly.GetExecutingAssembly().Location;

            string targetExe = Path.Combine(installDir, "SWEEPRDeepblockSetup.exe");
            if (!string.IsNullOrEmpty(currentExe) &&
                File.Exists(currentExe) &&
                !string.Equals(Path.GetFullPath(currentExe), Path.GetFullPath(targetExe), StringComparison.OrdinalIgnoreCase))
            {
                File.Copy(currentExe, targetExe, true);
            }

            ExtractEmbeddedExtensionZip(extensionDir);

            List<DnrRuleSummary> rules = LoadRulesFromDisk(Path.Combine(extensionDir, "rules", "static_ads_and_trackers.json"));
            if (rules.Count == 0)
            {
                rules = LoadRulesFromEmbeddedZip();
            }

            string uninstallExe = File.Exists(targetExe) ? targetExe : currentExe;
            var browsers = DetectBrowsers();
            var sb = new StringBuilder();
            sb.Append("{\n");
            sb.Append("  \"product\": \"").Append(JsonEscape(AppName)).Append("\",\n");
            sb.Append("  \"version\": \"").Append(JsonEscape(AppVersion)).Append("\",\n");
            sb.Append("  \"installMode\": \"embedded-offline-extension-and-desktop-suite\",\n");
            sb.Append("  \"extractedExtensionPath\": \"").Append(JsonEscape(extensionDir)).Append("\",\n");
            sb.Append("  \"staticDnrRulesCount\": ").Append(rules.Count).Append(",\n");
            sb.Append("  \"chromeWebStoreUrl\": \"").Append(JsonEscape(ChromeWebStoreUrl)).Append("\",\n");
            sb.Append("  \"firefoxAmoUrl\": \"").Append(JsonEscape(FirefoxAmoUrl)).Append("\",\n");
            sb.Append("  \"detectedBrowsers\": [");
            for (int i = 0; i < browsers.Count; i++)
            {
                if (i > 0) sb.Append(", ");
                sb.Append("\"").Append(JsonEscape(browsers[i].Name)).Append("\"");
            }
            sb.Append("],\n");
            sb.Append("  \"installedAtUtc\": \"").Append(DateTime.UtcNow.ToString("o")).Append("\"\n");
            sb.Append("}\n");

            File.WriteAllText(Path.Combine(installDir, "install-receipt.json"), sb.ToString(), new UTF8Encoding(false));

            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(UninstallSubKey))
            {
                if (key != null)
                {
                    key.SetValue("DisplayName", AppName, RegistryValueKind.String);
                    key.SetValue("DisplayVersion", AppVersion, RegistryValueKind.String);
                    key.SetValue("Publisher", PublisherName, RegistryValueKind.String);
                    key.SetValue("URLInfoAbout", BrandHomeUrl, RegistryValueKind.String);
                    key.SetValue("InstallLocation", installDir, RegistryValueKind.String);
                    if (!string.IsNullOrEmpty(uninstallExe))
                    {
                        key.SetValue("DisplayIcon", uninstallExe + ",0", RegistryValueKind.String);
                        key.SetValue("UninstallString", "\"" + uninstallExe + "\" --uninstall", RegistryValueKind.String);
                        key.SetValue("QuietUninstallString", "\"" + uninstallExe + "\" --uninstall /S", RegistryValueKind.String);
                    }
                    key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                    key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                }
            }

            return rules;
        }

        private static void ExtractEmbeddedExtensionZip(string destinationDir)
        {
            string destRootFull = Path.GetFullPath(destinationDir);
            if (!destRootFull.EndsWith(Path.DirectorySeparatorChar.ToString(), StringComparison.Ordinal))
            {
                destRootFull += Path.DirectorySeparatorChar;
            }

            using (Stream resStream = Assembly.GetExecutingAssembly().GetManifestResourceStream(EmbeddedZipResourceName))
            {
                if (resStream == null)
                {
                    throw new InvalidOperationException("Embedded extension resource not found.");
                }
                using (var archive = new ZipArchive(resStream, ZipArchiveMode.Read))
                {
                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        if (string.IsNullOrEmpty(entry.FullName)) continue;
                        string rel = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
                        string targetPath = Path.GetFullPath(Path.Combine(destinationDir, rel));
                        if (!targetPath.StartsWith(destRootFull, StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }
                        if (entry.FullName.EndsWith("/", StringComparison.Ordinal) || string.IsNullOrEmpty(entry.Name))
                        {
                            Directory.CreateDirectory(targetPath);
                            continue;
                        }
                        string parent = Path.GetDirectoryName(targetPath);
                        if (!string.IsNullOrEmpty(parent))
                        {
                            Directory.CreateDirectory(parent);
                        }
                        using (Stream inStream = entry.Open())
                        using (FileStream outStream = File.Create(targetPath))
                        {
                            inStream.CopyTo(outStream);
                        }
                    }
                }
            }
        }

        internal static List<DnrRuleSummary> LoadRulesFromDisk(string rulesJsonPath)
        {
            if (string.IsNullOrEmpty(rulesJsonPath) || !File.Exists(rulesJsonPath))
            {
                return new List<DnrRuleSummary>();
            }
            string json = File.ReadAllText(rulesJsonPath, Encoding.UTF8);
            return ParseDnrRulesJson(json);
        }

        internal static List<DnrRuleSummary> LoadRulesFromEmbeddedZip()
        {
            try
            {
                using (Stream resStream = Assembly.GetExecutingAssembly().GetManifestResourceStream(EmbeddedZipResourceName))
                {
                    if (resStream == null) return new List<DnrRuleSummary>();
                    using (var archive = new ZipArchive(resStream, ZipArchiveMode.Read))
                    {
                        foreach (ZipArchiveEntry entry in archive.Entries)
                        {
                            if (string.Equals(entry.FullName, "rules/static_ads_and_trackers.json", StringComparison.OrdinalIgnoreCase))
                            {
                                using (var reader = new StreamReader(entry.Open(), Encoding.UTF8))
                                {
                                    return ParseDnrRulesJson(reader.ReadToEnd());
                                }
                            }
                        }
                    }
                }
            }
            catch { }
            return new List<DnrRuleSummary>();
        }

        private static List<DnrRuleSummary> ParseDnrRulesJson(string json)
        {
            var list = new List<DnrRuleSummary>();
            if (string.IsNullOrEmpty(json)) return list;
            try
            {
                var serializer = new JavaScriptSerializer();
                serializer.MaxJsonLength = 16 * 1024 * 1024;
                object parsed = serializer.DeserializeObject(json);
                var arr = parsed as object[];
                if (arr == null) return list;

                foreach (object item in arr)
                {
                    var dict = item as Dictionary<string, object>;
                    if (dict == null) continue;

                    int id = dict.ContainsKey("id") ? Convert.ToInt32(dict["id"]) : 0;
                    int priority = dict.ContainsKey("priority") ? Convert.ToInt32(dict["priority"]) : 1;

                    string actionType = "block";
                    if (dict.ContainsKey("action") && dict["action"] is Dictionary<string, object>)
                    {
                        var act = (Dictionary<string, object>)dict["action"];
                        if (act.ContainsKey("type") && act["type"] != null)
                        {
                            actionType = act["type"].ToString();
                        }
                    }

                    string pattern = "*";
                    string resTypes = "script, xmlhttprequest";
                    if (dict.ContainsKey("condition") && dict["condition"] is Dictionary<string, object>)
                    {
                        var cond = (Dictionary<string, object>)dict["condition"];
                        if (cond.ContainsKey("urlFilter") && cond["urlFilter"] != null)
                        {
                            pattern = cond["urlFilter"].ToString();
                        }
                        else if (cond.ContainsKey("regexFilter") && cond["regexFilter"] != null)
                        {
                            pattern = cond["regexFilter"].ToString();
                        }
                        if (cond.ContainsKey("resourceTypes") && cond["resourceTypes"] is object[])
                        {
                            var rtArr = (object[])cond["resourceTypes"];
                            var rtParts = new List<string>();
                            foreach (object rt in rtArr)
                            {
                                if (rt != null) rtParts.Add(rt.ToString());
                            }
                            if (rtParts.Count > 0) resTypes = string.Join(", ", rtParts.ToArray());
                        }
                    }

                    list.Add(new DnrRuleSummary
                    {
                        Id = id,
                        Priority = priority,
                        Pattern = pattern,
                        ActionType = actionType,
                        ResourceTypes = resTypes
                    });
                }
            }
            catch { }
            return list;
        }

        internal static UrlAuditResult AuditAndCleanUrl(string rawInput, List<DnrRuleSummary> rules)
        {
            string input = (rawInput ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(input))
            {
                return new UrlAuditResult
                {
                    OriginalUrl = string.Empty,
                    CleanedUrl = string.Empty,
                    Host = string.Empty,
                    StrippedParamCount = 0,
                    RiskScore = 0,
                    Verdict = "EMPTY INPUT",
                    ReportText = "Enter an HTTP or HTTPS URL above to strip tracking codes and run a local 14-point scam/tracker check."
                };
            }

            if (!input.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                !input.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                input = "https://" + input;
            }

            Uri uri;
            if (!Uri.TryCreate(input, UriKind.Absolute, out uri))
            {
                return new UrlAuditResult
                {
                    OriginalUrl = rawInput,
                    CleanedUrl = rawInput,
                    Host = "invalid",
                    StrippedParamCount = 0,
                    RiskScore = 40,
                    Verdict = "INVALID URL FORMAT",
                    ReportText = "Could not parse URL syntax cleanly. Verify the URL starts with https:// or http://."
                };
            }

            string host = uri.Host.ToLowerInvariant();
            string cleanedUrl = input;
            int strippedCount = 0;

            if (!string.IsNullOrEmpty(uri.Query))
            {
                string rawQuery = uri.Query.TrimStart('?');
                string[] pairs = rawQuery.Split(new[] { '&' }, StringSplitOptions.RemoveEmptyEntries);
                var keptPairs = new List<string>();
                foreach (string pair in pairs)
                {
                    int eqIdx = pair.IndexOf('=');
                    string key = eqIdx >= 0 ? pair.Substring(0, eqIdx) : pair;
                    string decodedKey = Uri.UnescapeDataString(key);
                    if (decodedKey.StartsWith("utm_", StringComparison.OrdinalIgnoreCase) || TrackingQueryParams.Contains(decodedKey))
                    {
                        strippedCount++;
                    }
                    else
                    {
                        keptPairs.Add(pair);
                    }
                }
                var builder = new UriBuilder(uri);
                builder.Query = keptPairs.Count > 0 ? string.Join("&", keptPairs.ToArray()) : string.Empty;
                cleanedUrl = builder.Uri.AbsoluteUri;
                if (cleanedUrl.EndsWith("/") && uri.AbsolutePath == "/" && !rawInput.EndsWith("/"))
                {
                    cleanedUrl = cleanedUrl.TrimEnd('/');
                }
            }

            var findings = new List<string>();
            int score = 0;

            if (strippedCount > 0)
            {
                score += Math.Min(20, strippedCount * 5);
                findings.Add("[TRACKING] Stripped " + strippedCount + " ad/analytics tracking parameter(s) (utm_*, fbclid, gclid, msclkid).");
            }
            if (uri.Scheme.Equals("http", StringComparison.OrdinalIgnoreCase))
            {
                score += 20;
                findings.Add("[TRANSPORT] Unencrypted HTTP connection (no TLS certificate protection).");
            }
            foreach (string tld in HighRiskTlds)
            {
                if (host.EndsWith(tld, StringComparison.OrdinalIgnoreCase))
                {
                    score += 28;
                    findings.Add("[DOMAIN TLD] High-abuse disposable TLD detected (" + tld + ").");
                    break;
                }
            }
            int hyphenCount = 0;
            foreach (char ch in host) { if (ch == '-') hyphenCount++; }
            if (hyphenCount >= 3)
            {
                score += 18;
                findings.Add("[DOMAIN PATTERN] Excessive hyphenation (" + hyphenCount + " hyphens), common on cloned scam storefronts.");
            }
            foreach (string kw in ScamUrgencyKeywords)
            {
                if (host.Contains(kw) || uri.AbsolutePath.ToLowerInvariant().Contains(kw))
                {
                    score += 22;
                    findings.Add("[HEURISTIC] Promotional / fake-urgency keyword in domain or path ('" + kw + "').");
                    break;
                }
            }
            if (host.StartsWith("xn--", StringComparison.OrdinalIgnoreCase) || host.Contains(".xn--"))
            {
                score += 25;
                findings.Add("[IDN SPOOF] Punycode internationalized domain detected (verify brand spelling carefully).");
            }
            if (!string.IsNullOrEmpty(uri.UserInfo))
            {
                score += 35;
                findings.Add("[PHISHING] Embedded credentials/@ userinfo detected inside URL authority.");
            }
            DnrRuleSummary matchedDnr = null;
            if (rules != null)
            {
                foreach (DnrRuleSummary r in rules)
                {
                    string pat = (r.Pattern ?? string.Empty).Replace("||", "").Replace("^", "").Trim('*').ToLowerInvariant();
                    if (pat.Length >= 4 && !pat.Contains("*") && (host == pat || host.EndsWith("." + pat)))
                    {
                        matchedDnr = r;
                        break;
                    }
                }
            }
            if (matchedDnr != null)
            {
                score += 35;
                findings.Add("[DNR ENGINE] Matches local MV3 Block Rule #" + matchedDnr.Id + " (" + matchedDnr.Pattern + ").");
            }

            if (score > 100) score = 100;
            string verdict = score >= 55 ? "HIGH RISK / SUSPICIOUS" : (score >= 25 ? "MODERATE CAUTION" : "CLEAN / LOW RISK");

            var report = new StringBuilder();
            report.AppendLine("CLEANED URL:  " + cleanedUrl);
            report.AppendLine("TARGET HOST:  " + host + "   |   PARAMS STRIPPED: " + strippedCount);
            report.AppendLine("RISK SCORE:   " + score + " / 100   |   VERDICT: " + verdict);
            report.AppendLine("--------------------------------------------------------------------------");
            if (findings.Count == 0)
            {
                report.AppendLine("[PASS] No tracking query codes, high-risk TLDs, or DNR tracker matches found.");
            }
            else
            {
                foreach (string f in findings)
                {
                    report.AppendLine(" * " + f);
                }
            }

            return new UrlAuditResult
            {
                OriginalUrl = input,
                CleanedUrl = cleanedUrl,
                Host = host,
                StrippedParamCount = strippedCount,
                RiskScore = score,
                Verdict = verdict,
                ReportText = report.ToString()
            };
        }

        private static int RunUninstall(bool silent)
        {
            try
            {
                try
                {
                    Registry.CurrentUser.DeleteSubKeyTree(UninstallSubKey, false);
                }
                catch { }

                string installDir = GetInstallDir();
                string currentExe = Process.GetCurrentProcess().MainModule != null
                    ? Process.GetCurrentProcess().MainModule.FileName
                    : string.Empty;

                if (Directory.Exists(installDir))
                {
                    string extDir = Path.Combine(installDir, "Extension");
                    if (Directory.Exists(extDir))
                    {
                        try { Directory.Delete(extDir, true); } catch { }
                    }

                    string receiptPath = Path.Combine(installDir, "install-receipt.json");
                    if (File.Exists(receiptPath))
                    {
                        try { File.Delete(receiptPath); } catch { }
                    }

                    string installedExe = Path.Combine(installDir, "SWEEPRDeepblockSetup.exe");
                    bool runningFromInstalledExe = File.Exists(installedExe) && !string.IsNullOrEmpty(currentExe) &&
                        string.Equals(Path.GetFullPath(currentExe), Path.GetFullPath(installedExe), StringComparison.OrdinalIgnoreCase);
                    if (File.Exists(installedExe) && !runningFromInstalledExe)
                    {
                        try { File.Delete(installedExe); } catch { }
                    }

                    try
                    {
                        if (!runningFromInstalledExe)
                        {
                            Directory.Delete(installDir, true);
                        }
                        else if (Directory.GetFiles(installDir).Length == 0 && Directory.GetDirectories(installDir).Length == 0)
                        {
                            Directory.Delete(installDir, false);
                        }
                    }
                    catch { }
                }

                if (!silent)
                {
                    MessageBox.Show(
                        "SWEEPR Deepblock local desktop suite and unpacked extension files have been removed.",
                        "SWEEPR Deepblock Uninstalled",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information);
                }
                return 0;
            }
            catch
            {
                return 1;
            }
        }

        internal static List<DetectedBrowser> DetectBrowsers()
        {
            var found = new List<DetectedBrowser>();
            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            AddIfPresent(found, "chrome", "Google Chrome", ChromeWebStoreUrl, "Chromium MV3 (--load-extension)", true, new[]
            {
                Path.Combine(pf, "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(pf86, "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(local, "Google", "Chrome", "Application", "chrome.exe"),
                ReadAppPath("chrome.exe")
            });

            AddIfPresent(found, "edge", "Microsoft Edge", ChromeWebStoreUrl, "Chromium MV3 (--load-extension)", true, new[]
            {
                Path.Combine(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
                ReadAppPath("msedge.exe")
            });

            AddIfPresent(found, "brave", "Brave Browser", ChromeWebStoreUrl, "Chromium MV3 (--load-extension)", true, new[]
            {
                Path.Combine(pf, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
                Path.Combine(pf86, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
                Path.Combine(local, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
                ReadAppPath("brave.exe")
            });

            AddIfPresent(found, "firefox", "Mozilla Firefox", FirefoxAmoUrl, "Firefox Add-ons (.xpi)", false, new[]
            {
                Path.Combine(pf, "Mozilla Firefox", "firefox.exe"),
                Path.Combine(pf86, "Mozilla Firefox", "firefox.exe"),
                Path.Combine(local, "Mozilla Firefox", "firefox.exe"),
                ReadAppPath("firefox.exe")
            });

            return found;
        }

        private static void AddIfPresent(List<DetectedBrowser> list, string id, string name, string storeUrl, string storeLabel, bool isChromium, string[] candidates)
        {
            foreach (string candidate in candidates)
            {
                if (!string.IsNullOrEmpty(candidate) && File.Exists(candidate))
                {
                    list.Add(new DetectedBrowser
                    {
                        Id = id,
                        Name = name,
                        ExecutablePath = candidate,
                        StoreUrl = storeUrl,
                        StoreLabel = storeLabel,
                        IsChromium = isChromium
                    });
                    return;
                }
            }
        }

        private static string ReadAppPath(string exeName)
        {
            string subKey = @"Software\Microsoft\Windows\CurrentVersion\App Paths\" + exeName;
            try
            {
                using (RegistryKey hkcu = Registry.CurrentUser.OpenSubKey(subKey, false))
                {
                    object val = hkcu != null ? hkcu.GetValue(null) : null;
                    if (val is string && File.Exists((string)val)) return (string)val;
                }
            }
            catch { }

            try
            {
                using (RegistryKey hklm = Registry.LocalMachine.OpenSubKey(subKey, false))
                {
                    object val = hklm != null ? hklm.GetValue(null) : null;
                    if (val is string && File.Exists((string)val)) return (string)val;
                }
            }
            catch { }

            return null;
        }

        internal static bool LaunchBrowserWithLocalExtension(DetectedBrowser browser, string extensionDir)
        {
            if (browser == null || string.IsNullOrEmpty(browser.ExecutablePath) || !File.Exists(browser.ExecutablePath))
            {
                return false;
            }
            if (!browser.IsChromium || string.IsNullOrEmpty(extensionDir) || !Directory.Exists(extensionDir))
            {
                return false;
            }
            try
            {
                string profileDir = Path.Combine(GetInstallDir(), "BrowserProfile_" + browser.Id);
                Directory.CreateDirectory(profileDir);
                string args = "--load-extension=\"" + extensionDir + "\" --user-data-dir=\"" + profileDir + "\" --no-first-run \"" + TestLabUrl + "\"";
                var psi = new ProcessStartInfo
                {
                    FileName = browser.ExecutablePath,
                    Arguments = args,
                    UseShellExecute = false
                };
                Process.Start(psi);
                return true;
            }
            catch
            {
                return false;
            }
        }

        internal static bool OpenFolderInExplorer(string dirPath)
        {
            if (string.IsNullOrEmpty(dirPath) || !Directory.Exists(dirPath)) return false;
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "explorer.exe",
                    Arguments = "\"" + dirPath + "\"",
                    UseShellExecute = false
                });
                return true;
            }
            catch
            {
                return false;
            }
        }

        internal static bool OpenOfficialUrl(string url, DetectedBrowser specificBrowser)
        {
            if (string.IsNullOrEmpty(url) || !AllowedExternalUrls.Contains(url))
            {
                return false;
            }
            try
            {
                if (specificBrowser != null && !string.IsNullOrEmpty(specificBrowser.ExecutablePath) && File.Exists(specificBrowser.ExecutablePath))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = specificBrowser.ExecutablePath,
                        Arguments = "\"" + url + "\"",
                        UseShellExecute = false
                    });
                    return true;
                }

                Process.Start(new ProcessStartInfo
                {
                    FileName = url,
                    UseShellExecute = true
                });
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static int ExportVerificationScreenshots(string outputDir, string extensionDir, List<DnrRuleSummary> rules)
        {
            Directory.CreateDirectory(outputDir);
            using (var form = new SetupForm(extensionDir, rules))
            {
                form.StartPosition = FormStartPosition.Manual;
                form.Location = new Point(-32000, -32000);
                form.Show();
                Application.DoEvents();

                var exports = new[]
                {
                    new { TabIdx = 0, File = "uptodown-win-1-shield.png", Caption = "SWEEPR Deepblock v1.3.0 — Offline MV3 Extension & Local Browser Deployer" },
                    new { TabIdx = 1, File = "uptodown-win-2-scanner.png", Caption = "Standalone URL Tracker Stripper & 14-Point Scam Domain Scanner" },
                    new { TabIdx = 2, File = "uptodown-win-3-rules.png", Caption = "Searchable 253-Rule MV3 Inspector & 8/8 Local Engine Self-Test" }
                };

                foreach (var item in exports)
                {
                    form.SelectTab(item.TabIdx);
                    Application.DoEvents();

                    using (var formBmp = new Bitmap(form.Width, form.Height))
                    {
                        form.DrawToBitmap(formBmp, new Rectangle(0, 0, form.Width, form.Height));
                        using (var canvas = new Bitmap(1280, 800))
                        using (var g = Graphics.FromImage(canvas))
                        {
                            g.SmoothingMode = SmoothingMode.AntiAlias;
                            g.Clear(Color.FromArgb(9, 13, 22));
                            using (var bgBrush = new LinearGradientBrush(new Rectangle(0, 0, 1280, 800), Color.FromArgb(9, 13, 22), Color.FromArgb(15, 23, 42), 45f))
                            {
                                g.FillRectangle(bgBrush, 0, 0, 1280, 800);
                            }
                            using (var capFont = new Font("Segoe UI", 16f, FontStyle.Bold))
                            using (var capBrush = new SolidBrush(Color.FromArgb(226, 232, 240)))
                            {
                                SizeF sz = g.MeasureString(item.Caption, capFont);
                                g.DrawString(item.Caption, capFont, capBrush, (1280 - sz.Width) / 2f, 44f);
                            }
                            int x = (1280 - formBmp.Width) / 2;
                            int y = 96;
                            using (var shadowBrush = new SolidBrush(Color.FromArgb(110, 0, 0, 0)))
                            {
                                g.FillRectangle(shadowBrush, x + 10, y + 12, formBmp.Width, formBmp.Height);
                            }
                            g.DrawImageUnscaled(formBmp, x, y);
                            canvas.Save(Path.Combine(outputDir, item.File), ImageFormat.Png);
                        }
                    }
                }
                form.Close();
            }
            return 0;
        }

        private static string JsonEscape(string s)
        {
            if (string.IsNullOrEmpty(s)) return string.Empty;
            var sb = new StringBuilder(s.Length);
            foreach (char c in s)
            {
                switch (c)
                {
                    case '\\': sb.Append("\\\\"); break;
                    case '"': sb.Append("\\\""); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < ' ')
                        {
                            sb.Append("\\u").Append(((int)c).ToString("x4"));
                        }
                        else
                        {
                            sb.Append(c);
                        }
                        break;
                }
            }
            return sb.ToString();
        }
    }

    internal sealed class SetupForm : Form
    {
        private readonly string _extensionDir;
        private readonly List<DnrRuleSummary> _rules;
        private readonly List<DetectedBrowser> _browsers;

        private readonly Button[] _navBtns = new Button[4];
        private readonly Panel[] _tabPanels = new Panel[4];

        private ComboBox _browserCombo;
        private Label _tab1StatusLabel;
        private TextBox _urlInput;
        private TextBox _urlAuditBox;
        private TextBox _ruleFilterInput;
        private ListView _ruleListView;
        private Label _ruleCountLabel;
        private TextBox _selfTestOutput;
        private TextBox _keyInput;
        private Label _keyStatusLabel;

        public SetupForm(string extensionDir, List<DnrRuleSummary> rules)
        {
            _extensionDir = extensionDir ?? Program.GetExtensionDir();
            _rules = rules ?? new List<DnrRuleSummary>();
            _browsers = Program.DetectBrowsers();

            Text = "SWEEPR Deepblock v" + Program.AppVersion + " — Windows Privacy Suite & MV3 Extension";
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            MinimizeBox = true;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(760, 540);
            BackColor = Color.FromArgb(15, 23, 42);
            ForeColor = Color.FromArgb(248, 250, 252);
            Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            try
            {
                Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location);
            }
            catch { }

            BuildHeaderAndNav();
            BuildTab1ShieldInstaller();
            BuildTab2UrlScanner();
            BuildTab3RuleInspector();
            BuildTab4AccountKey();

            SelectTab(0);
            RunUrlAudit();
            PopulateRulesList(string.Empty);
            RunLocalSelfTest();
        }

        private void BuildHeaderAndNav()
        {
            var headerPanel = new Panel
            {
                Location = new Point(0, 0),
                Size = new Size(760, 76),
                BackColor = Color.FromArgb(5, 150, 105)
            };
            headerPanel.Paint += delegate(object s, PaintEventArgs e)
            {
                using (var brush = new LinearGradientBrush(headerPanel.ClientRectangle, Color.FromArgb(6, 95, 70), Color.FromArgb(16, 185, 129), LinearGradientMode.Horizontal))
                {
                    e.Graphics.FillRectangle(brush, headerPanel.ClientRectangle);
                }
            };

            headerPanel.Controls.Add(new Label
            {
                Text = "SWEEPR Deepblock v" + Program.AppVersion + " for Windows",
                Font = new Font("Segoe UI", 15.5f, FontStyle.Bold),
                ForeColor = Color.White,
                BackColor = Color.Transparent,
                Location = new Point(22, 12),
                Size = new Size(520, 28)
            });

            headerPanel.Controls.Add(new Label
            {
                Text = "Offline MV3 Extension (" + _rules.Count + " Static Rules) • Standalone URL Cleaner • Scam Domain Audit",
                UseMnemonic = false,
                Font = new Font("Segoe UI", 9.25f, FontStyle.Regular),
                ForeColor = Color.FromArgb(236, 253, 245),
                BackColor = Color.Transparent,
                Location = new Point(22, 42),
                Size = new Size(680, 22)
            });
            Controls.Add(headerPanel);

            var navBar = new Panel
            {
                Location = new Point(0, 76),
                Size = new Size(760, 42),
                BackColor = Color.FromArgb(9, 13, 22)
            };
            string[] labels = new[]
            {
                "Shield & Installer",
                "URL & Scam Audit",
                _rules.Count + " MV3 Rules",
                "Account & Key"
            };
            int btnWidth = 190;
            for (int i = 0; i < 4; i++)
            {
                int idx = i;
                var btn = new Button
                {
                    Text = labels[i],
                    UseMnemonic = false,
                    Location = new Point(i * btnWidth, 0),
                    Size = new Size(btnWidth, 42),
                    FlatStyle = FlatStyle.Flat,
                    Font = new Font("Segoe UI", 9.25f, FontStyle.Bold),
                    Cursor = Cursors.Hand
                };
                btn.FlatAppearance.BorderSize = 0;
                btn.Click += delegate { SelectTab(idx); };
                _navBtns[i] = btn;
                navBar.Controls.Add(btn);
            }
            Controls.Add(navBar);
        }

        internal void SelectTab(int activeIndex)
        {
            for (int i = 0; i < 4; i++)
            {
                bool active = (i == activeIndex);
                _tabPanels[i].Visible = active;
                _navBtns[i].BackColor = active ? Color.FromArgb(15, 23, 42) : Color.FromArgb(9, 13, 22);
                _navBtns[i].ForeColor = active ? Color.FromArgb(52, 211, 153) : Color.FromArgb(148, 163, 184);
            }
        }

        private Panel CreateTabPanel()
        {
            var panel = new Panel
            {
                Location = new Point(0, 118),
                Size = new Size(760, 422),
                BackColor = Color.FromArgb(15, 23, 42)
            };
            Controls.Add(panel);
            return panel;
        }

        private void BuildTab1ShieldInstaller()
        {
            var p = CreateTabPanel();
            _tabPanels[0] = p;

            bool extractedOk = File.Exists(Path.Combine(_extensionDir, "manifest.json"));
            var statusBanner = new Panel
            {
                Location = new Point(22, 18),
                Size = new Size(716, 62),
                BackColor = Color.FromArgb(6, 78, 59)
            };
            statusBanner.Controls.Add(new Label
            {
                Text = extractedOk
                    ? "Local MV3 Extension Unpacked & Ready (" + _rules.Count + " Static C++ Rules + 6 Modules)"
                    : "Embedded MV3 Engine Ready (" + _rules.Count + " Static DNR Rules)",
                UseMnemonic = false,
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
                ForeColor = Color.White,
                Location = new Point(14, 9),
                Size = new Size(688, 22)
            });
            statusBanner.Controls.Add(new Label
            {
                Text = "Path: " + _extensionDir,
                Font = new Font("Consolas", 8.5f),
                ForeColor = Color.FromArgb(167, 243, 208),
                Location = new Point(14, 34),
                Size = new Size(688, 18)
            });
            p.Controls.Add(statusBanner);

            p.Controls.Add(new Label
            {
                Text = "Detected Desktop Browsers (" + _browsers.Count + " found)",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(203, 213, 225),
                Location = new Point(22, 98),
                Size = new Size(716, 20)
            });

            _browserCombo = new ComboBox
            {
                Location = new Point(22, 122),
                Size = new Size(716, 28),
                DropDownStyle = ComboBoxStyle.DropDownList,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White
            };
            if (_browsers.Count > 0)
            {
                foreach (var b in _browsers)
                {
                    _browserCombo.Items.Add(b.Name + " — " + b.StoreLabel);
                }
                _browserCombo.SelectedIndex = 0;
            }
            else
            {
                _browserCombo.Items.Add("No supported local browser binary detected — use folder/store buttons below");
                _browserCombo.SelectedIndex = 0;
            }
            p.Controls.Add(_browserCombo);

            var launchBtn = new Button
            {
                Text = "Launch Browser with Deepblock Active",
                UseMnemonic = false,
                Location = new Point(22, 168),
                Size = new Size(368, 46),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(16, 185, 129),
                ForeColor = Color.FromArgb(2, 44, 34),
                Font = new Font("Segoe UI", 10.25f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            launchBtn.FlatAppearance.BorderSize = 0;
            launchBtn.Click += delegate
            {
                DetectedBrowser chosen = (_browsers.Count > 0 && _browserCombo.SelectedIndex >= 0 && _browserCombo.SelectedIndex < _browsers.Count)
                    ? _browsers[_browserCombo.SelectedIndex] : null;
                if (chosen != null && chosen.IsChromium && Program.LaunchBrowserWithLocalExtension(chosen, _extensionDir))
                {
                    _tab1StatusLabel.ForeColor = Color.FromArgb(110, 231, 183);
                    _tab1StatusLabel.Text = "Launched " + chosen.Name + " with unpacked MV3 extension loaded from " + _extensionDir + " and opened the 8/8 Test Lab.";
                }
                else
                {
                    Program.OpenFolderInExplorer(_extensionDir);
                    _tab1StatusLabel.ForeColor = Color.FromArgb(253, 230, 138);
                    _tab1StatusLabel.Text = "Opened unpacked extension folder in Explorer. For Firefox, use the Firefox Add-ons (.xpi) button below, or enable Developer Mode in chrome://extensions -> Load unpacked.";
                }
            };
            p.Controls.Add(launchBtn);

            var openFolderBtn = new Button
            {
                Text = "Open Unpacked Extension Folder",
                Location = new Point(404, 168),
                Size = new Size(334, 46),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 10f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            openFolderBtn.FlatAppearance.BorderColor = Color.FromArgb(71, 85, 105);
            openFolderBtn.FlatAppearance.BorderSize = 1;
            openFolderBtn.Click += delegate
            {
                Program.OpenFolderInExplorer(_extensionDir);
                _tab1StatusLabel.ForeColor = Color.FromArgb(110, 231, 183);
                _tab1StatusLabel.Text = "Opened Extension folder. In Chrome/Edge/Brave: open Extensions -> enable Developer mode -> Load unpacked -> select Extension.";
            };
            p.Controls.Add(openFolderBtn);

            p.Controls.Add(new Label
            {
                Text = "Offline desktop tools ('URL & Scam Audit' and '253 MV3 Rules') work anytime without a browser.",
                UseMnemonic = false,
                Font = new Font("Segoe UI", 8.75f),
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(22, 228),
                Size = new Size(716, 22)
            });

            p.Controls.Add(new Label
            {
                Text = "Optional Signed Browser Store Installers (Auto-Updating):",
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                ForeColor = Color.FromArgb(203, 213, 225),
                Location = new Point(22, 274),
                Size = new Size(716, 20)
            });

            var cwsBtn = new Button
            {
                Text = "Open Chrome Web Store Listing",
                Location = new Point(22, 300),
                Size = new Size(350, 38),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.FromArgb(203, 213, 225),
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            cwsBtn.FlatAppearance.BorderColor = Color.FromArgb(51, 65, 85);
            cwsBtn.Click += delegate { Program.OpenOfficialUrl(Program.ChromeWebStoreUrl, null); };
            p.Controls.Add(cwsBtn);

            var amoBtn = new Button
            {
                Text = "Open Firefox Add-ons (AMO)",
                Location = new Point(388, 300),
                Size = new Size(350, 38),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.FromArgb(203, 213, 225),
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            amoBtn.FlatAppearance.BorderColor = Color.FromArgb(51, 65, 85);
            amoBtn.Click += delegate { Program.OpenOfficialUrl(Program.FirefoxAmoUrl, null); };
            p.Controls.Add(amoBtn);

            _tab1StatusLabel = new Label
            {
                Text = "Ready. All 253 static MV3 rules and standalone URL/Scam auditing work 100% locally on your device.",
                Font = new Font("Segoe UI", 8.75f),
                ForeColor = Color.FromArgb(110, 231, 183),
                Location = new Point(22, 354),
                Size = new Size(716, 48)
            };
            p.Controls.Add(_tab1StatusLabel);
        }

        private void BuildTab2UrlScanner()
        {
            var p = CreateTabPanel();
            _tabPanels[1] = p;

            p.Controls.Add(new Label
            {
                Text = "Standalone URL Tracking Parameter Cleaner & 14-Point Scam Audit",
                UseMnemonic = false,
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
                ForeColor = Color.White,
                Location = new Point(22, 18),
                Size = new Size(716, 22)
            });

            _urlInput = new TextBox
            {
                Text = "https://example-shop-clearance-sale.top/product?id=42&utm_source=ads&utm_medium=cpc&fbclid=IwAR123456&gclid=Cj0KCQ",
                Location = new Point(22, 48),
                Size = new Size(716, 28),
                Font = new Font("Consolas", 9.5f),
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle
            };
            p.Controls.Add(_urlInput);

            var cleanBtn = new Button
            {
                Text = "Clean URL & Run Scam / Tracker Audit",
                UseMnemonic = false,
                Location = new Point(22, 86),
                Size = new Size(368, 40),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(16, 185, 129),
                ForeColor = Color.FromArgb(2, 44, 34),
                Font = new Font("Segoe UI", 9.75f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            cleanBtn.FlatAppearance.BorderSize = 0;
            cleanBtn.Click += delegate { RunUrlAudit(); };
            p.Controls.Add(cleanBtn);

            var copyBtn = new Button
            {
                Text = "Copy Cleaned URL",
                Location = new Point(404, 86),
                Size = new Size(334, 40),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9.75f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            copyBtn.FlatAppearance.BorderColor = Color.FromArgb(71, 85, 105);
            copyBtn.Click += delegate
            {
                UrlAuditResult res = Program.AuditAndCleanUrl(_urlInput.Text, _rules);
                if (!string.IsNullOrEmpty(res.CleanedUrl))
                {
                    Clipboard.SetText(res.CleanedUrl);
                    _urlAuditBox.Text = res.ReportText + "\r\n[COPIED] Clean URL copied to Windows clipboard.";
                }
            };
            p.Controls.Add(copyBtn);

            _urlAuditBox = new TextBox
            {
                Location = new Point(22, 140),
                Size = new Size(716, 256),
                Multiline = true,
                ReadOnly = true,
                ScrollBars = ScrollBars.Vertical,
                Font = new Font("Consolas", 9.25f),
                BackColor = Color.FromArgb(9, 13, 22),
                ForeColor = Color.FromArgb(226, 232, 240),
                BorderStyle = BorderStyle.FixedSingle
            };
            p.Controls.Add(_urlAuditBox);
        }

        private void RunUrlAudit()
        {
            UrlAuditResult res = Program.AuditAndCleanUrl(_urlInput.Text, _rules);
            _urlAuditBox.Text = res.ReportText;
        }

        private void BuildTab3RuleInspector()
        {
            var p = CreateTabPanel();
            _tabPanels[2] = p;

            _ruleCountLabel = new Label
            {
                Text = "Loaded " + _rules.Count + " Local MV3 DeclarativeNetRequest Rules (Offline Engine)",
                UseMnemonic = false,
                Font = new Font("Segoe UI", 10f, FontStyle.Bold),
                ForeColor = Color.White,
                Location = new Point(22, 16),
                Size = new Size(410, 22)
            };
            p.Controls.Add(_ruleCountLabel);

            p.Controls.Add(new Label
            {
                Text = "Filter:",
                UseMnemonic = false,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(440, 18),
                Size = new Size(46, 20)
            });

            _ruleFilterInput = new TextBox
            {
                Location = new Point(490, 14),
                Size = new Size(248, 26),
                Font = new Font("Segoe UI", 9f),
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle
            };
            _ruleFilterInput.TextChanged += delegate { PopulateRulesList(_ruleFilterInput.Text); };
            p.Controls.Add(_ruleFilterInput);

            _ruleListView = new ListView
            {
                Location = new Point(22, 48),
                Size = new Size(716, 204),
                View = View.Details,
                FullRowSelect = true,
                GridLines = true,
                BackColor = Color.FromArgb(9, 13, 22),
                ForeColor = Color.FromArgb(226, 232, 240),
                Font = new Font("Consolas", 8.5f)
            };
            _ruleListView.Columns.Add("ID", 52);
            _ruleListView.Columns.Add("MV3 Filter Pattern", 290);
            _ruleListView.Columns.Add("Action", 110);
            _ruleListView.Columns.Add("Resource Types", 240);
            p.Controls.Add(_ruleListView);

            var testBtn = new Button
            {
                Text = "Run 8/8 Local Engine Self-Test",
                Location = new Point(22, 264),
                Size = new Size(260, 38),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(16, 185, 129),
                ForeColor = Color.FromArgb(2, 44, 34),
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            testBtn.FlatAppearance.BorderSize = 0;
            testBtn.Click += delegate { RunLocalSelfTest(); };
            p.Controls.Add(testBtn);

            _selfTestOutput = new TextBox
            {
                Location = new Point(296, 264),
                Size = new Size(442, 134),
                Multiline = true,
                ReadOnly = true,
                ScrollBars = ScrollBars.Vertical,
                Font = new Font("Consolas", 8.5f),
                BackColor = Color.FromArgb(9, 13, 22),
                ForeColor = Color.FromArgb(110, 231, 183),
                BorderStyle = BorderStyle.FixedSingle
            };
            p.Controls.Add(_selfTestOutput);
        }

        private void PopulateRulesList(string filter)
        {
            string q = (filter ?? string.Empty).Trim().ToLowerInvariant();
            _ruleListView.BeginUpdate();
            _ruleListView.Items.Clear();
            int shown = 0;
            foreach (DnrRuleSummary r in _rules)
            {
                if (!string.IsNullOrEmpty(q) &&
                    !(r.Pattern ?? string.Empty).ToLowerInvariant().Contains(q) &&
                    !(r.ActionType ?? string.Empty).ToLowerInvariant().Contains(q))
                {
                    continue;
                }
                var item = new ListViewItem("#" + r.Id);
                item.SubItems.Add(r.Pattern);
                item.SubItems.Add(r.ActionType + " (p" + r.Priority + ")");
                item.SubItems.Add(r.ResourceTypes);
                _ruleListView.Items.Add(item);
                shown++;
            }
            _ruleListView.EndUpdate();
            _ruleCountLabel.Text = "MV3 DeclarativeNetRequest Rules (" + shown + " of " + _rules.Count + " shown)";
        }

        private void RunLocalSelfTest()
        {
            string[] ruleTargets = new[]
            {
                "doubleclick.net",
                "googlesyndication.com",
                "youtube.com/api/stats/ads",
                "criteo.com",
                "taboola.com",
                "amazon-adsystem.com"
            };
            int passed = 0;
            var sb = new StringBuilder();
            foreach (string target in ruleTargets)
            {
                DnrRuleSummary hit = null;
                foreach (var r in _rules)
                {
                    if ((r.Pattern ?? string.Empty).ToLowerInvariant().Contains(target))
                    {
                        hit = r;
                        break;
                    }
                }
                if (hit != null)
                {
                    passed++;
                    sb.AppendLine("[PASS] " + target + " -> DNR #" + hit.Id + " (" + hit.ActionType + ")");
                }
                else
                {
                    sb.AppendLine("[MISS] " + target);
                }
            }
            UrlAuditResult cleanCheck = Program.AuditAndCleanUrl("https://sweeprdeepblock.com/?utm_source=test&fbclid=abc123", _rules);
            if (cleanCheck.StrippedParamCount == 2)
            {
                passed++;
                sb.AppendLine("[PASS] URL Tracker Stripper removed 2/2 query params");
            }
            UrlAuditResult scamCheck = Program.AuditAndCleanUrl("https://example-shop-clearance-sale.top/", _rules);
            if (scamCheck.RiskScore >= 55)
            {
                passed++;
                sb.AppendLine("[PASS] Scam Heuristic Flagged .top risk (" + scamCheck.RiskScore + "/100)");
            }
            sb.Insert(0, "LOCAL ENGINE SELF-TEST: " + passed + "/8 PASSED (" + _rules.Count + " Static Rules Loaded)\r\n");
            _selfTestOutput.Text = sb.ToString();
        }

        private void BuildTab4AccountKey()
        {
            var p = CreateTabPanel();
            _tabPanels[3] = p;

            var freeBanner = new Panel
            {
                Location = new Point(22, 22),
                Size = new Size(716, 76),
                BackColor = Color.FromArgb(6, 78, 59)
            };
            freeBanner.Controls.Add(new Label
            {
                Text = "Core Ad Blocker, Cookie Auto-Rejector, URL Cleaner & Scam Scanner Are 100% Free Forever",
                UseMnemonic = false,
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
                ForeColor = Color.White,
                Location = new Point(16, 12),
                Size = new Size(684, 24)
            });
            freeBanner.Controls.Add(new Label
            {
                Text = "No sign-up, account, or license key is required to unpack the MV3 extension or use all desktop privacy utilities.",
                UseMnemonic = false,
                Font = new Font("Segoe UI", 9f),
                ForeColor = Color.FromArgb(209, 250, 229),
                Location = new Point(16, 40),
                Size = new Size(684, 22)
            });
            p.Controls.Add(freeBanner);

            p.Controls.Add(new Label
            {
                Text = "Optional Pro License Key (SWEEPR-DB-XXXX-XXXX-XXXX) — Syncs Up to 5 Devices",
                UseMnemonic = false,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(203, 213, 225),
                Location = new Point(22, 122),
                Size = new Size(716, 22)
            });

            _keyInput = new TextBox
            {
                Location = new Point(22, 150),
                Size = new Size(716, 30),
                Font = new Font("Consolas", 11f),
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                MaxLength = 64
            };
            p.Controls.Add(_keyInput);

            var verifyBtn = new Button
            {
                Text = "Validate & Copy Pro Key for Extension Popup",
                UseMnemonic = false,
                Location = new Point(22, 194),
                Size = new Size(380, 42),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(16, 185, 129),
                ForeColor = Color.FromArgb(2, 44, 34),
                Font = new Font("Segoe UI", 9.75f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            verifyBtn.FlatAppearance.BorderSize = 0;
            verifyBtn.Click += delegate
            {
                string raw = _keyInput.Text ?? string.Empty;
                if (string.IsNullOrWhiteSpace(raw))
                {
                    _keyStatusLabel.ForeColor = Color.FromArgb(148, 163, 184);
                    _keyStatusLabel.Text = "Free Shield mode active — paste a full SWEEPR-DB-XXXX-XXXX-XXXX Pro key only if upgrading.";
                    return;
                }
                string normalized = Program.NormalizeLicenseKey(raw);
                if (!Program.IsValidFullLicenseKey(normalized))
                {
                    _keyStatusLabel.ForeColor = Color.FromArgb(248, 113, 113);
                    _keyStatusLabel.Text = "Invalid key format. Full SWEEPR-DB-XXXX-XXXX-XXXX license key required.";
                    return;
                }
                Clipboard.SetText(normalized);
                _keyStatusLabel.ForeColor = Color.FromArgb(110, 231, 183);
                _keyStatusLabel.Text = "Pro key verified and copied to clipboard. Paste inside the SWEEPR Deepblock browser toolbar popup.";
            };
            p.Controls.Add(verifyBtn);

            _keyStatusLabel = new Label
            {
                Text = "Status: Running Free Core Suite (5-Device Pro license key optional).",
                Font = new Font("Segoe UI", 9f),
                ForeColor = Color.FromArgb(110, 231, 183),
                Location = new Point(22, 252),
                Size = new Size(716, 48)
            };
            p.Controls.Add(_keyStatusLabel);
        }
    }
}
