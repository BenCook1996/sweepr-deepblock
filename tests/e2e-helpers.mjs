import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const WEBSITE_DIR = path.join(ROOT, 'website');
export const CANONICAL_ORIGIN = 'https://sweeprdeepblock.com';
export const RUN_TEAMWORK_ROOT =
  'C:\\Users\\Benjamin\\.gemini\\antigravity\\brain\\3f0ca682-3495-48b3-961e-e9eb2abde650\\scratch\\.agents\\teamwork';
export const M1_DEFAULT_CUT_LIST_94_PATH =
  'C:\\Users\\Benjamin\\.gemini\\antigravity\\brain\\e2144c4b-c077-4a53-85ee-75d6b49eb0e2\\scratch\\.agents\\teamwork\\worker_remediate_m1_iter4\\CUT_LIST_94.json';

export function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

export function readExtensionManifest() {
  const manifestPath = path.join(ROOT, 'extension', 'manifest.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

export function readDynamicDeltaVersion() {
  const deltaPath = path.join(ROOT, 'extension', 'rules', 'dynamic_delta.json');
  if (!fs.existsSync(deltaPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(deltaPath, 'utf8'));
    return typeof parsed?.version === 'string' && parsed.version.trim() ? parsed.version.trim() : null;
  } catch {
    return null;
  }
}

export function resolveCutList94() {
  const explicitPath = (process.env.CUT_LIST_94_PATH || '').trim();
  if (explicitPath && !fs.existsSync(explicitPath)) {
    throw new Error(`CUT_LIST_94_PATH is set to "${explicitPath}", but the file does not exist`);
  }

  const candidates = [
    explicitPath,
    path.join(ROOT, 'data', 'CUT_LIST_94.json'),
    path.join(RUN_TEAMWORK_ROOT, 'CUT_LIST_94.json'),
    M1_DEFAULT_CUT_LIST_94_PATH
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      const entries = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.items)
        ? parsed.items
        : Array.isArray(parsed?.entries)
        ? parsed.entries
        : Array.isArray(parsed?.cutList)
        ? parsed.cutList
        : Array.isArray(parsed?.urls)
        ? parsed.urls
        : null;
      if (!entries) {
        throw new Error(`CUT_LIST_94.json at ${candidate} does not contain an array of entries`);
      }
      return { path: candidate, entries };
    }
  }
  return null;
}

export function resolveCniEnriched() {
  const candidates = [
    process.env.CNI_ENRICHED_PATH,
    'C:\\Users\\Benjamin\\.gemini\\antigravity\\brain\\ae3607ed-a3a1-476f-ac01-d7300625cc0e\\scratch\\cni_enriched_2026_11_22.json'
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (Array.isArray(parsed?.enrichedCni)) {
        return { path: candidate, entries: parsed.enrichedCni };
      }
    }
  }
  return null;
}

function waitForProcExit(proc, maxWaitMs = 2000) {
  if (!proc || proc.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      proc.off('exit', done);
      resolve();
    };
    const timer = setTimeout(done, maxWaitMs);
    proc.once('exit', done);
  });
}

const WIN32_CHROME_HELPER_CS = `using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace SweeprChromeHelper {
  class Program {
    const uint CREATE_SUSPENDED = 0x00000004;
    const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
    const int JobObjectBasicAccountingInformation = 1;
    const int JobObjectExtendedLimitInformation = 9;
    const uint STILL_ACTIVE = 259;
    const uint WAIT_TIMEOUT = 0x00000102;
    const uint TH32CS_SNAPPROCESS = 0x00000002;
    const uint PROCESS_TERMINATE = 0x0001;
    const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    const uint SYNCHRONIZE = 0x00100000;
    const int ProcessCommandLineInformation = 60;
    const int STATUS_INFO_LENGTH_MISMATCH = unchecked((int)0xC0000004);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct STARTUPINFO {
      public int cb;
      public string lpReserved;
      public string lpDesktop;
      public string lpTitle;
      public int dwX;
      public int dwY;
      public int dwXSize;
      public int dwYSize;
      public int dwXCountChars;
      public int dwYCountChars;
      public int dwFillAttribute;
      public int dwFlags;
      public short wShowWindow;
      public short cbReserved2;
      public IntPtr lpReserved2;
      public IntPtr hStdInput;
      public IntPtr hStdOutput;
      public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PROCESS_INFORMATION {
      public IntPtr hProcess;
      public IntPtr hThread;
      public uint dwProcessId;
      public uint dwThreadId;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
      public long PerProcessUserTimeLimit;
      public long PerJobUserTimeLimit;
      public uint LimitFlags;
      public UIntPtr MinimumWorkingSetSize;
      public UIntPtr MaximumWorkingSetSize;
      public uint ActiveProcessLimit;
      public UIntPtr Affinity;
      public uint PriorityClass;
      public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct IO_COUNTERS {
      public ulong ReadOperationCount;
      public ulong WriteOperationCount;
      public ulong OtherOperationCount;
      public ulong ReadTransferCount;
      public ulong WriteTransferCount;
      public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
      public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
      public IO_COUNTERS IoInfo;
      public UIntPtr ProcessMemoryLimit;
      public UIntPtr JobMemoryLimit;
      public UIntPtr PeakProcessMemoryUsed;
      public UIntPtr PeakJobMemoryUsed;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct JOBOBJECT_BASIC_ACCOUNTING_INFORMATION {
      public long TotalUserTime;
      public long TotalKernelTime;
      public long ThisPeriodTotalUserTime;
      public long ThisPeriodTotalKernelTime;
      public uint TotalPageFaultCount;
      public uint TotalProcesses;
      public uint ActiveProcesses;
      public uint TotalTerminatedProcesses;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct PROCESSENTRY32 {
      public uint dwSize;
      public uint cntUsage;
      public uint th32ProcessID;
      public IntPtr th32DefaultHeapID;
      public uint th32ModuleID;
      public uint cntThreads;
      public uint th32ParentProcessID;
      public int pcPriClassBase;
      public uint dwFlags;
      [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
      public string szExeFile;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct UNICODE_STRING {
      public ushort Length;
      public ushort MaximumLength;
      public IntPtr Buffer;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern bool CreateProcessW(
      string lpApplicationName,
      string lpCommandLine,
      IntPtr lpProcessAttributes,
      IntPtr lpThreadAttributes,
      bool bInheritHandles,
      uint dwCreationFlags,
      IntPtr lpEnvironment,
      string lpCurrentDirectory,
      ref STARTUPINFO lpStartupInfo,
      out PROCESS_INFORMATION lpProcessInformation
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern uint ResumeThread(IntPtr hThread);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool CloseHandle(IntPtr hObject);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetInformationJobObject(IntPtr hJob, int JobObjectInfoClass, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool QueryInformationJobObject(IntPtr hJob, int JobObjectInfoClass, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength, out uint lpReturnLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool TerminateJobObject(IntPtr hJob, uint uExitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetExitCodeProcess(IntPtr hProcess, out uint lpExitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool TerminateProcess(IntPtr hProcess, uint uExitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr CreateToolhelp32Snapshot(uint dwFlags, uint th32ProcessID);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode, EntryPoint = "Process32FirstW")]
    static extern bool Process32FirstW(IntPtr hSnapshot, ref PROCESSENTRY32 lppe);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode, EntryPoint = "Process32NextW")]
    static extern bool Process32NextW(IntPtr hSnapshot, ref PROCESSENTRY32 lppe);

    [DllImport("ntdll.dll")]
    static extern int NtQueryInformationProcess(
      IntPtr ProcessHandle,
      int ProcessInformationClass,
      IntPtr ProcessInformation,
      uint ProcessInformationLength,
      out uint ReturnLength
    );

    static string QuoteArg(string arg) {
      if (arg == null) return "\\"\\"";
      if (arg.Length > 0 && arg.IndexOfAny(new char[] { ' ', '\\t', '\\n', '\\v', '"' }) == -1) {
        return arg;
      }
      var sb = new StringBuilder();
      sb.Append('"');
      int backslashes = 0;
      for (int i = 0; i < arg.Length; i++) {
        char c = arg[i];
        if (c == '\\\\') {
          backslashes++;
        } else if (c == '"') {
          sb.Append('\\\\', backslashes * 2 + 1);
          sb.Append('"');
          backslashes = 0;
        } else {
          if (backslashes > 0) {
            sb.Append('\\\\', backslashes);
            backslashes = 0;
          }
          sb.Append(c);
        }
      }
      if (backslashes > 0) sb.Append('\\\\', backslashes * 2);
      sb.Append('"');
      return sb.ToString();
    }

    static string GetProcessCommandLine(uint pid) {
      IntPtr hProc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
      if (hProc == IntPtr.Zero) return null;
      IntPtr buf = IntPtr.Zero;
      try {
        uint bufSize = 8192;
        buf = Marshal.AllocHGlobal((int)bufSize);
        uint retLen = 0;
        int status = NtQueryInformationProcess(hProc, ProcessCommandLineInformation, buf, bufSize, out retLen);
        if (status == STATUS_INFO_LENGTH_MISMATCH || (status != 0 && retLen > bufSize)) {
          Marshal.FreeHGlobal(buf);
          bufSize = retLen + 256;
          buf = Marshal.AllocHGlobal((int)bufSize);
          status = NtQueryInformationProcess(hProc, ProcessCommandLineInformation, buf, bufSize, out retLen);
        }
        if (status != 0) return null;
        UNICODE_STRING us = (UNICODE_STRING)Marshal.PtrToStructure(buf, typeof(UNICODE_STRING));
        if (us.Length == 0 || us.Buffer == IntPtr.Zero) return "";
        return Marshal.PtrToStringUni(us.Buffer, us.Length / 2);
      } finally {
        if (buf != IntPtr.Zero) Marshal.FreeHGlobal(buf);
        CloseHandle(hProc);
      }
    }

    struct ProcInfo {
      public uint Pid;
      public uint ParentPid;
    }

    static bool IsProcessAlive(uint pid) {
      IntPtr h = OpenProcess(SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
      if (h == IntPtr.Zero) {
        int err = Marshal.GetLastWin32Error();
        if (err != 5) return false;
        h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
        if (h == IntPtr.Zero) return Marshal.GetLastWin32Error() == 5;
        try {
          uint ec = 0;
          return GetExitCodeProcess(h, out ec) && ec == STILL_ACTIVE;
        } finally {
          CloseHandle(h);
        }
      }
      try {
        uint ec = 0;
        if (GetExitCodeProcess(h, out ec) && ec != STILL_ACTIVE) return false;
        return WaitForSingleObject(h, 0) == WAIT_TIMEOUT;
      } finally {
        CloseHandle(h);
      }
    }

    static List<uint> FindMatchingPids(uint rootPid, string dirTag, string exeName) {
      var candidates = new List<ProcInfo>();
      uint selfPid = (uint)Process.GetCurrentProcess().Id;
      IntPtr snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
      if (snap == IntPtr.Zero || snap == new IntPtr(-1)) return new List<uint>();
      try {
        PROCESSENTRY32 pe = new PROCESSENTRY32();
        pe.dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32));
        if (Process32FirstW(snap, ref pe)) {
          do {
            if (pe.th32ProcessID != selfPid && string.Equals(pe.szExeFile, exeName, StringComparison.OrdinalIgnoreCase)) {
              candidates.Add(new ProcInfo { Pid = pe.th32ProcessID, ParentPid = pe.th32ParentProcessID });
            }
            pe.dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32));
          } while (Process32NextW(snap, ref pe));
        }
      } finally {
        CloseHandle(snap);
      }

      var pidSet = new HashSet<uint>();
      if (rootPid > 0) {
        pidSet.Add(rootPid);
        bool added = true;
        while (added) {
          added = false;
          for (int i = 0; i < candidates.Count; i++) {
            if (pidSet.Contains(candidates[i].ParentPid) && !pidSet.Contains(candidates[i].Pid)) {
              pidSet.Add(candidates[i].Pid);
              added = true;
            }
          }
        }
      }

      var matched = new List<uint>();
      for (int i = 0; i < candidates.Count; i++) {
        uint pid = candidates[i].Pid;
        if (!IsProcessAlive(pid)) continue;
        if (pidSet.Contains(pid)) {
          matched.Add(pid);
          continue;
        }
        if (!string.IsNullOrEmpty(dirTag)) {
          string cmdLine = GetProcessCommandLine(pid);
          if (!string.IsNullOrEmpty(cmdLine) && cmdLine.IndexOf(dirTag, StringComparison.OrdinalIgnoreCase) >= 0) {
            matched.Add(pid);
          }
        }
      }
      return matched;
    }

    static int SweepOrphans(uint rootPid, string dirTag, string exeName, int maxSweepMs = 10000) {
      Stopwatch sw = Stopwatch.StartNew();
      while (sw.ElapsedMilliseconds < maxSweepMs) {
        List<uint> targets = FindMatchingPids(rootPid, dirTag, exeName);
        if (targets.Count == 0) return 0;
        for (int i = 0; i < targets.Count; i++) {
          int rem = (int)Math.Max(100, Math.Min(500, maxSweepMs - sw.ElapsedMilliseconds));
          IntPtr h = OpenProcess(PROCESS_TERMINATE | SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION, false, targets[i]);
          if (h != IntPtr.Zero) {
            try {
              uint ec = 0;
              if (GetExitCodeProcess(h, out ec) && ec == STILL_ACTIVE) {
                TerminateProcess(h, 1);
              }
              WaitForSingleObject(h, (uint)rem);
            } finally {
              CloseHandle(h);
            }
          }
        }
        if (sw.ElapsedMilliseconds < maxSweepMs) Thread.Sleep(50);
      }
      List<uint> remaining = FindMatchingPids(rootPid, dirTag, exeName);
      if (remaining.Count > 0) {
        var pidStrings = new string[remaining.Count];
        for (int i = 0; i < remaining.Count; i++) pidStrings[i] = remaining[i].ToString();
        Console.Error.WriteLine("SWEEP_SURVIVORS count=" + remaining.Count + " pids=" + string.Join(",", pidStrings));
      }
      return remaining.Count;
    }

    static bool WaitJobEmpty(IntPtr hJob, int maxWaitMs) {
      int size = Marshal.SizeOf(typeof(JOBOBJECT_BASIC_ACCOUNTING_INFORMATION));
      IntPtr ptr = Marshal.AllocHGlobal(size);
      try {
        Stopwatch sw = Stopwatch.StartNew();
        while (sw.ElapsedMilliseconds < maxWaitMs) {
          uint retLen = 0;
          if (QueryInformationJobObject(hJob, JobObjectBasicAccountingInformation, ptr, (uint)size, out retLen)) {
            var info = (JOBOBJECT_BASIC_ACCOUNTING_INFORMATION)Marshal.PtrToStructure(ptr, typeof(JOBOBJECT_BASIC_ACCOUNTING_INFORMATION));
            if (info.ActiveProcesses == 0) return true;
          }
          Thread.Sleep(15);
        }
        return false;
      } finally {
        Marshal.FreeHGlobal(ptr);
      }
    }

    static int RunLaunch(string[] args) {
      if (args.Length < 3) {
        Console.Error.WriteLine("Usage: --launch <dirTag> <exePath> [args...]");
        return 2;
      }
      string dirTag = args[1];
      string exePath = args[2];
      var cmdParts = new List<string>();
      cmdParts.Add(QuoteArg(exePath));
      for (int i = 3; i < args.Length; i++) cmdParts.Add(QuoteArg(args[i]));
      string cmdLine = string.Join(" ", cmdParts.ToArray());

      IntPtr hJob = CreateJobObject(IntPtr.Zero, null);
      if (hJob == IntPtr.Zero) {
        Console.Error.WriteLine("CreateJobObject failed: " + Marshal.GetLastWin32Error());
        return 2;
      }

      int eliSize = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
      IntPtr eliPtr = Marshal.AllocHGlobal(eliSize);
      try {
        var eli = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        eli.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        Marshal.StructureToPtr(eli, eliPtr, false);
        if (!SetInformationJobObject(hJob, JobObjectExtendedLimitInformation, eliPtr, (uint)eliSize)) {
          Console.Error.WriteLine("SetInformationJobObject failed: " + Marshal.GetLastWin32Error());
          CloseHandle(hJob);
          return 2;
        }
      } finally {
        Marshal.FreeHGlobal(eliPtr);
      }

      var si = new STARTUPINFO();
      si.cb = Marshal.SizeOf(typeof(STARTUPINFO));

      PROCESS_INFORMATION pi;
      if (!CreateProcessW(exePath, cmdLine, IntPtr.Zero, IntPtr.Zero, false, CREATE_SUSPENDED, IntPtr.Zero, null, ref si, out pi)) {
        Console.Error.WriteLine("CreateProcessW failed: " + Marshal.GetLastWin32Error());
        CloseHandle(hJob);
        return 2;
      }

      if (!AssignProcessToJobObject(hJob, pi.hProcess)) {
        int err = Marshal.GetLastWin32Error();
        TerminateProcess(pi.hProcess, 1);
        CloseHandle(pi.hThread);
        CloseHandle(pi.hProcess);
        CloseHandle(hJob);
        Console.Error.WriteLine("AssignProcessToJobObject failed: " + err);
        return 3;
      }

      ResumeThread(pi.hThread);
      CloseHandle(pi.hThread);

      Console.WriteLine("CHILD_PID=" + pi.dwProcessId);
      Console.Out.Flush();

      var stopEvent = new ManualResetEvent(false);
      var gracefulEvent = new ManualResetEvent(false);
      var stdinThread = new Thread(delegate() {
        try {
          string line;
          while ((line = Console.In.ReadLine()) != null) {
            string trimmed = line.Trim();
            if (trimmed == "GRACEFUL") {
              gracefulEvent.Set();
            } else if (trimmed == "KILL") {
              break;
            }
          }
        } catch {}
        stopEvent.Set();
      });
      stdinThread.IsBackground = true;
      stdinThread.Start();

      bool killedByRequest = false;
      while (true) {
        if (stopEvent.WaitOne(100)) {
          killedByRequest = true;
          break;
        }
        uint ec = STILL_ACTIVE;
        if (GetExitCodeProcess(pi.hProcess, out ec) && ec != STILL_ACTIVE) {
          break;
        }
      }

      bool jobEmpty = false;
      if (!killedByRequest && gracefulEvent.WaitOne(0)) {
        jobEmpty = WaitJobEmpty(hJob, 10000);
      }

      if (!jobEmpty) {
        TerminateJobObject(hJob, 1);
        WaitJobEmpty(hJob, 3000);
      }
      WaitForSingleObject(pi.hProcess, 250);
      CloseHandle(pi.hProcess);
      CloseHandle(hJob);

      int survivors = SweepOrphans(pi.dwProcessId, dirTag, Path.GetFileName(exePath));
      return survivors == 0 ? 0 : 1;
    }

    static int Main(string[] args) {
      if (args.Length >= 1 && args[0] == "--launch") {
        return RunLaunch(args);
      }
      if (args.Length >= 4 && args[0] == "--sweep") {
        uint rootPid = 0;
        uint.TryParse(args[1], out rootPid);
        string dirTag = args[2];
        string exeName = args[3];
        int survivors = SweepOrphans(rootPid, dirTag, exeName);
        return survivors == 0 ? 0 : 1;
      }
      Console.Error.WriteLine("Unknown arguments");
      return 2;
    }
  }
}`;

let cachedWin32HelperPath = null;

function findCscBinary() {
  const winDir = process.env.WINDIR || 'C:\\Windows';
  const candidates = [
    path.join(winDir, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
    path.join(winDir, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function ensureWin32ChromeHelper() {
  if (process.platform !== 'win32') return null;
  if (cachedWin32HelperPath && fs.existsSync(cachedWin32HelperPath)) {
    return cachedWin32HelperPath;
  }

  const hash = crypto.createHash('sha256').update(WIN32_CHROME_HELPER_CS).digest('hex').slice(0, 12);
  const cachedExe = path.join(os.tmpdir(), `sweepr-chrome-helper-${hash}.exe`);
  if (fs.existsSync(cachedExe)) {
    cachedWin32HelperPath = cachedExe;
    return cachedExe;
  }

  const cscPath = findCscBinary();
  if (!cscPath) return null;

  const uniq = `${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const tmpCs = path.join(os.tmpdir(), `sweepr-chrome-helper-${hash}-${uniq}.cs`);
  const tmpExe = path.join(os.tmpdir(), `sweepr-chrome-helper-${hash}-${uniq}.exe`);

  try {
    fs.writeFileSync(tmpCs, WIN32_CHROME_HELPER_CS, 'utf8');
    execFileSync(cscPath, ['/nologo', '/optimize+', '/target:exe', `/out:${tmpExe}`, tmpCs], {
      stdio: 'pipe',
      timeout: 60000
    });
    try {
      fs.renameSync(tmpExe, cachedExe);
    } catch (renameErr) {
      if (!fs.existsSync(cachedExe)) throw renameErr;
    }
    cachedWin32HelperPath = cachedExe;
    return cachedExe;
  } finally {
    try { fs.rmSync(tmpCs, { force: true }); } catch {}
    try { fs.rmSync(tmpExe, { force: true }); } catch {}
  }
}

function killProcessTree(proc) {
  if (!proc) return false;
  let taskkillOk = false;
  if (proc.exitCode === null) {
    if (process.platform === 'win32' && proc.pid) {
      try {
        execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', timeout: 10000 });
        taskkillOk = true;
      } catch {}
      if (!taskkillOk && proc.exitCode === null) {
        try {
          proc.kill();
        } catch {}
      }
    } else {
      try {
        proc.kill('SIGTERM');
      } catch {}
      try {
        if (proc.exitCode === null) proc.kill('SIGKILL');
      } catch {}
    }
  }
  try { proc.stdout?.destroy(); } catch {}
  try { proc.stderr?.destroy(); } catch {}
  return taskkillOk;
}

function tryWindowsShellRemoveDir(dirPath) {
  if (process.platform !== 'win32' || !dirPath || !fs.existsSync(dirPath)) return;
  try {
    execFileSync(
      'cmd.exe',
      ['/d', '/s', '/c', `attrib -r -s -h "${dirPath}\\*.*" /s /d >nul 2>&1 & rmdir /s /q "${dirPath}"`],
      { stdio: 'ignore', timeout: 15000 }
    );
  } catch {}
  if (fs.existsSync(dirPath)) {
    const escaped = dirPath.replace(/'/g, "''");
    try {
      execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `Remove-Item -LiteralPath '${escaped}' -Recurse -Force -ErrorAction SilentlyContinue`
        ],
        { stdio: 'ignore', timeout: 15000 }
      );
    } catch {}
  }
}

function pruneUnlockedEntries(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          pruneUnlockedEntries(fullPath);
          fs.rmdirSync(fullPath);
        } else {
          try {
            fs.chmodSync(fullPath, 0o666);
          } catch {}
          fs.rmSync(fullPath, { force: true });
        }
      } catch {}
    }
    try {
      fs.rmdirSync(dirPath);
    } catch {}
  } catch {}
}

export async function removeDirSafe(dirPath, attempts = 80, delayMs = 300) {
  if (!dirPath) return true;
  for (let i = 0; i < attempts; i += 1) {
    try {
      if (!fs.existsSync(dirPath)) return true;
      fs.rmSync(dirPath, { recursive: true, force: true });
      if (!fs.existsSync(dirPath)) return true;
    } catch (err) {
      if (process.platform === 'win32' && (err?.code === 'EPERM' || err?.code === 'EBUSY' || i >= 1)) {
        pruneUnlockedEntries(dirPath);
        if (!fs.existsSync(dirPath)) return true;
        if (i === 1 || i === 3 || i === 7 || i === 15 || i === 30 || i === attempts - 1) {
          tryWindowsShellRemoveDir(dirPath);
          if (!fs.existsSync(dirPath)) return true;
        }
      }
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  } catch {}
  if (process.platform === 'win32' && fs.existsSync(dirPath)) {
    await new Promise((r) => setTimeout(r, 400));
    pruneUnlockedEntries(dirPath);
    tryWindowsShellRemoveDir(dirPath);
  }
  return !fs.existsSync(dirPath);
}

export async function startEphemeralServer({ timeoutMs = 15000 } = {}) {
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweepr-e2e-data-'));
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  // Import ./server.js inside child process so require.main !== module:
  // prevents binding default port 3000/8080, pushServiceHealth, and 15s checkStaleCmoJobs().
  const bootScript = `
    const server = require('./server.js');
    const port = Number(process.env.PORT);
    server.listen(port, '127.0.0.1', () => {
      process.stdout.write('E2E_SERVER_READY:' + port + '\\n');
    });
  `;

  const proc = spawn(process.execPath, ['-e', bootScript], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(port),
      PUBLIC_URL: baseUrl,
      NODE_ENV: 'test',
      DISABLE_CMO_AUTOPILOT: '1',
      DATA_DIR: tempDataDir,
      SESSION_SECRET: `e2e_session_${crypto.randomBytes(16).toString('hex')}`,
      ENABLE_IN_PROCESS_SEO_BUILDERS: 'false',
      SWEEPR_CRM_URL: 'http://127.0.0.1:1',
      SWEEPR_CRM_API_KEY: '',
      CRM_ADMIN_PASSWORD: '',
      ADMIN_API_KEY: '',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      TRUST_PROXY: '',
      TRUST_CLOUDFLARE: ''
    }
  });

  let stdoutBuf = '';
  let stderrBuf = '';
  proc.stdout.on('data', (chunk) => {
    stdoutBuf += chunk.toString();
  });
  proc.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString();
  });

  const deadline = Date.now() + timeoutMs;
  let ready = false;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      killProcessTree(proc);
      await waitForProcExit(proc, 1000);
      await removeDirSafe(tempDataDir, 30, 250);
      throw new Error(
        `Ephemeral server exited early (code ${proc.exitCode}). stdout=${stdoutBuf} stderr=${stderrBuf}`
      );
    }
    try {
      const res = await fetch(`${baseUrl}/api/healthz`, { signal: AbortSignal.timeout(1000) });
      if (res.status === 200) {
        const json = await res.json();
        if (json && json.ok === true) {
          ready = true;
          break;
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!ready) {
    killProcessTree(proc);
    await waitForProcExit(proc, 1000);
    await removeDirSafe(tempDataDir, 30, 250);
    throw new Error(`Ephemeral server timed out after ${timeoutMs}ms. stdout=${stdoutBuf} stderr=${stderrBuf}`);
  }

  const stop = async () => {
    if (proc.exitCode === null) {
      try {
        proc.kill('SIGTERM');
      } catch {}
      await waitForProcExit(proc, 1000);
    }
    killProcessTree(proc);
    await waitForProcExit(proc, 1000);
    await removeDirSafe(tempDataDir, 30, 250);
  };

  return { port, baseUrl, tempDataDir, proc, stop };
}

export function decodeXmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function parseSitemapUrls(xmlPath) {
  const raw = fs.readFileSync(xmlPath, 'utf8');
  const locs = [];
  const duplicates = [];
  const seen = new Set();
  for (const m of raw.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
    const loc = decodeXmlEntities(m[1].trim());
    if (seen.has(loc)) duplicates.push(loc);
    seen.add(loc);
    locs.push(loc);
  }
  const paths = locs.map((loc) => {
    const u = new URL(loc);
    return u.pathname || '/';
  });
  return { raw, locs, paths, duplicates };
}

export function parseSitemapIndex(xmlPath) {
  return parseSitemapUrls(xmlPath);
}

export function parseRobotsTxt(robotsPath) {
  const raw = fs.readFileSync(robotsPath, 'utf8');
  const groups = [];
  let currentGroup = null;
  const sitemaps = [];

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const val = line.slice(colonIdx + 1).trim();

    if (key === 'user-agent') {
      if (!currentGroup || currentGroup.rules.length > 0) {
        currentGroup = { agents: [val.toLowerCase()], rules: [] };
        groups.push(currentGroup);
      } else {
        currentGroup.agents.push(val.toLowerCase());
      }
    } else if (key === 'allow' || key === 'disallow') {
      if (currentGroup && val !== '') {
        currentGroup.rules.push({ type: key, pattern: val });
      }
    } else if (key === 'sitemap') {
      sitemaps.push(val);
    }
  }

  return { raw, groups, sitemaps };
}

function robotsPatternToRegex(pattern) {
  const endAnchored = pattern.endsWith('$');
  const core = endAnchored ? pattern.slice(0, -1) : pattern;
  const escaped = core.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + (endAnchored ? '$' : ''));
}

export function isDisallowedByRobots(urlPath, robotsData, userAgent = '*') {
  const uaLower = userAgent.toLowerCase();
  const matchingGroups = robotsData.groups.filter((g) => g.agents.includes(uaLower));
  const groupsToCheck =
    matchingGroups.length > 0 ? matchingGroups : robotsData.groups.filter((g) => g.agents.includes('*'));

  for (const group of groupsToCheck) {
    let bestRule = null;
    for (const rule of group.rules) {
      const re = robotsPatternToRegex(rule.pattern);
      if (re.test(urlPath)) {
        if (
          !bestRule ||
          rule.pattern.length > bestRule.pattern.length ||
          (rule.pattern.length === bestRule.pattern.length && rule.type === 'allow')
        ) {
          bestRule = rule;
        }
      }
    }
    if (bestRule && bestRule.type === 'disallow') return true;
  }
  return false;
}

export function normalizeUrlPath(href) {
  if (typeof href !== 'string') return '';
  const trimmed = href.trim();
  if (!trimmed) return '';
  const noOrigin = trimmed.replace(/^https?:\/\/(?:www\.)?sweeprdeepblock\.com/i, '');
  return noOrigin.startsWith('/') ? noOrigin : '/' + noOrigin;
}

export function parseHtmlAttrs(attrStr) {
  const attrs = {};
  const re = /([a-zA-Z0-9:_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(attrStr)) !== null) {
    const key = m[1].toLowerCase();
    const val = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
    if (!(key in attrs)) attrs[key] = val;
  }
  return attrs;
}

export function extractAllMetaTags(html) {
  const cleanHtml = String(html || '').replace(/<!--[\s\S]*?-->/g, '');
  const tags = [];
  for (const m of cleanHtml.matchAll(/<meta\b([^>]*)>/gi)) {
    const attrs = parseHtmlAttrs(m[1]);
    tags.push({
      name: (attrs.name || '').trim(),
      property: (attrs.property || '').trim(),
      content: decodeXmlEntities((attrs.content || '').trim()),
      attrs
    });
  }
  return tags;
}

export function extractAllMetaRobots(html) {
  return extractAllMetaTags(html)
    .filter((t) => t.name.toLowerCase() === 'robots' && t.content !== '')
    .map((t) => t.content);
}

export function extractMetaRobots(html) {
  const all = extractAllMetaRobots(html);
  return all.length > 0 ? all.join(', ') : null;
}

export function extractAllCanonicals(html) {
  const cleanHtml = String(html || '').replace(/<!--[\s\S]*?-->/g, '');
  const canonicals = [];
  for (const m of cleanHtml.matchAll(/<link\b([^>]*)>/gi)) {
    const attrs = parseHtmlAttrs(m[1]);
    const relTokens = (attrs.rel || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (relTokens.includes('canonical') && attrs.href !== undefined) {
      const href = decodeXmlEntities(attrs.href.trim());
      if (href) canonicals.push(href);
    }
  }
  return canonicals;
}

export function extractCanonical(html) {
  const all = extractAllCanonicals(html);
  return all.length > 0 ? all[0] : null;
}

export function extractJsonLdBlocks(html) {
  const blocks = [];
  const errors = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let index = 0;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1].trim();
    try {
      blocks.push(JSON.parse(raw));
    } catch (err) {
      errors.push(`JSON-LD block #${index} parse error: ${err.message}`);
    }
    index += 1;
  }
  return { blocks, errors };
}

export function collectJsonLdTypes(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdTypes(item, out);
    return out;
  }
  if (typeof node['@type'] === 'string') {
    out.push(node['@type']);
  } else if (Array.isArray(node['@type'])) {
    for (const t of node['@type']) {
      if (typeof t === 'string') out.push(t);
    }
  }
  for (const val of Object.values(node)) {
    if (val && typeof val === 'object') collectJsonLdTypes(val, out);
  }
  return out;
}

export function collectJsonLdFields(node, fieldNames, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdFields(item, fieldNames, out);
    return out;
  }
  for (const [k, v] of Object.entries(node)) {
    if (fieldNames.includes(k)) {
      out.push({ key: k, value: v, type: node['@type'] || null, name: node.name || null });
    }
    if (v && typeof v === 'object') collectJsonLdFields(v, fieldNames, out);
  }
  return out;
}

export function stripNonProseForBacktickCheck(html) {
  return String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, ' ')
    .replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractVisibleText(html) {
  return String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function runConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIdx = 0;
  async function runner() {
    while (true) {
      const idx = nextIdx++;
      if (idx >= items.length) break;
      results[idx] = await worker(items[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runner());
  await Promise.all(workers);
  return results;
}

export function findBrowserBinary() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);

  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin;
  }
  throw new Error(`No Chrome/Edge headless binary found. Checked: ${candidates.join(', ')}`);
}

class CdpConnection {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.eventListeners = new Map();
    this.closeListeners = new Set();
    this.closed = false;

    ws.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
      } catch {
        return;
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, timer } = this.pending.get(msg.id);
        clearTimeout(timer);
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(`CDP error ${msg.error.code}: ${msg.error.message}`));
        } else {
          resolve(msg.result);
        }
      } else if (msg.method) {
        const key = `${msg.sessionId || ''}:${msg.method}`;
        const list = this.eventListeners.get(key);
        if (list) {
          for (const cb of [...list]) cb(msg.params || {});
        }
      }
    });

    ws.addEventListener('close', () => {
      this._handleDisconnect('CDP connection closed');
    });

    ws.addEventListener('error', (err) => {
      this._handleDisconnect(`CDP WebSocket error: ${err?.message || err?.type || 'unknown'}`);
    });
  }

  _handleDisconnect(reason) {
    if (this.closed) return;
    this.closed = true;
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(new Error(reason));
    }
    this.pending.clear();
    for (const cb of [...this.closeListeners]) {
      try { cb(reason); } catch {}
    }
  }

  on(method, cb, sessionId = '') {
    const key = `${sessionId}:${method}`;
    if (!this.eventListeners.has(key)) this.eventListeners.set(key, new Set());
    this.eventListeners.get(key).add(cb);
    return () => this.eventListeners.get(key)?.delete(cb);
  }

  onClose(cb) {
    this.closeListeners.add(cb);
    return () => this.closeListeners.delete(cb);
  }

  send(method, params = {}, sessionId = undefined, timeoutMs = 15000) {
    if (this.closed || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error(`CDP connection closed before sending ${method}`));
    }
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out (${timeoutMs}ms): ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
      try {
        this.ws.send(JSON.stringify(payload));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  close() {
    this._handleDisconnect('CDP connection closed');
    try {
      this.ws.close();
    } catch {}
  }
}

export async function launchHeadlessBrowser({ timeoutMs = 30000 } = {}) {
  const bin = findBrowserBinary();
  const winHelperExe = process.platform === 'win32' ? ensureWin32ChromeHelper() : null;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweepr-cdp-'));
  const dirTag = path.basename(userDataDir);
  const binName = path.basename(bin);
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-gpu-shader-disk-cache',
    '--disable-extensions',
    '--disable-sync',
    '--disable-crash-reporter',
    '--disable-breakpad',
    '--disable-features=OptimizationHints,OptimizationGuideModelDownloading,SegmentationPlatform,SafeBrowsing,ChromeVariations,MediaRouter,SpareRendererForSitePerProcess,Translate',
    '--metrics-recording-only',
    '--disable-default-apps',
    '--disable-domain-reliability',
    '--disable-client-side-phishing-detection',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--no-pings',
    '--mute-audio',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ];

  const proc = winHelperExe
    ? spawn(winHelperExe, ['--launch', dirTag, bin, ...args], { stdio: ['pipe', 'pipe', 'pipe'] })
    : spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdin?.on('error', () => {});

  let rootPid = winHelperExe ? 0 : (proc.pid || 0);
  let stdoutBuf = '';
  let stderrBuf = '';
  let wsUrl = null;
  proc.stdout.on('data', (chunk) => {
    stdoutBuf += chunk.toString();
    if (winHelperExe && !rootPid) {
      const m = stdoutBuf.match(/CHILD_PID=(\d+)/);
      if (m) rootPid = Number(m[1]);
    }
  });
  proc.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString();
    const m = stderrBuf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (m) wsUrl = m[1];
  });

  let ws = null;
  let cdp = null;

  const cleanupBrowserProcesses = async () => {
    try { cdp?.close(); } catch {}
    try { ws?.close(); } catch {}

    if (process.platform === 'win32') {
      let sweepZeroProcesses = false;
      try {
        if (winHelperExe) {
          const wasAlreadyExited = proc.exitCode !== null;
          if (!wasAlreadyExited) {
            try {
              proc.stdin?.write('KILL\n');
              proc.stdin?.end();
            } catch {}
            await waitForProcExit(proc, 5000);
          }
          if (proc.exitCode === null) {
            killProcessTree(proc);
            await waitForProcExit(proc, 1500);
          }
          execFileSync(
            winHelperExe,
            ['--sweep', String(rootPid), dirTag, binName],
            { encoding: 'utf8', timeout: 15000 }
          );
          sweepZeroProcesses = true;
          if (!wasAlreadyExited && proc.exitCode !== null && proc.exitCode !== 0) {
            throw new Error(
              `Win32 Chrome helper exited with code ${proc.exitCode}. stdout=${stdoutBuf.slice(-500)} stderr=${stderrBuf.slice(-1000)}`
            );
          }
        } else {
          if (proc.exitCode === null) {
            killProcessTree(proc);
          }
          await waitForProcExit(proc, 3000);
          const escapedBinName = binName.replace(/'/g, "''");
          const escapedDirTag = dirTag.replace(/'/g, "''");
          const psCmd =
            `$targets = @(Get-CimInstance Win32_Process -Filter "Name='${escapedBinName}'" | Where-Object { $_.ProcessId -eq ${rootPid} -or $_.ParentProcessId -eq ${rootPid} -or $_.CommandLine -like '*${escapedDirTag}*' }); ` +
            `foreach ($t in $targets) { Stop-Process -Id $t.ProcessId -Force -ErrorAction SilentlyContinue }; ` +
            `foreach ($t in $targets) { $p = Get-Process -Id $t.ProcessId -ErrorAction SilentlyContinue; if ($p) { try { [void]$p.WaitForExit(5000) } catch {} } }; ` +
            `$left = @(Get-CimInstance Win32_Process -Filter "Name='${escapedBinName}'" | Where-Object { $_.ProcessId -eq ${rootPid} -or $_.ParentProcessId -eq ${rootPid} -or $_.CommandLine -like '*${escapedDirTag}*' }); ` +
            `if ($left.Count -gt 0) { throw ('Survivors remain: ' + (($left | ForEach-Object { $_.ProcessId }) -join ',')) }`;
          execFileSync(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', psCmd],
            { encoding: 'utf8', timeout: 60000 }
          );
          sweepZeroProcesses = true;
        }
      } finally {
        try { proc.stdout?.destroy(); } catch {}
        try { proc.stderr?.destroy(); } catch {}
        await removeDirSafe(userDataDir, 80, 300);
      }
      if (fs.existsSync(userDataDir)) {
        if (sweepZeroProcesses) {
          console.warn(`[e2e-helpers] Transient DELETE_PENDING on ${userDataDir} after 0 live/rundown Chrome processes`);
        } else {
          throw new Error(`Failed to remove Chrome userDataDir after browser.close(): ${userDataDir}`);
        }
      }
    } else {
      if (proc.exitCode === null) {
        killProcessTree(proc);
        await waitForProcExit(proc, 1500);
      } else {
        try { proc.stdout?.destroy(); } catch {}
        try { proc.stderr?.destroy(); } catch {}
      }
      await removeDirSafe(userDataDir, 80, 300);
      if (fs.existsSync(userDataDir)) {
        throw new Error(`Failed to remove Chrome userDataDir after browser.close(): ${userDataDir}`);
      }
    }
  };

  try {
    const deadline = Date.now() + timeoutMs;
    while (!wsUrl && Date.now() < deadline && proc.exitCode === null) {
      const activePortPath = path.join(userDataDir, 'DevToolsActivePort');
      if (fs.existsSync(activePortPath)) {
        try {
          const lines = fs.readFileSync(activePortPath, 'utf8').trim().split(/\r?\n/);
          if (lines[0] && lines[1]) {
            wsUrl = `ws://127.0.0.1:${lines[0]}${lines[1]}`;
            break;
          }
        } catch {}
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    if (!wsUrl) {
      throw new Error(`Headless browser failed to expose CDP WebSocket within ${timeoutMs}ms. stderr=${stderrBuf}`);
    }

    ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(val);
      };
      const timer = setTimeout(() => finish(reject, new Error('WebSocket open timeout')), 10000);
      ws.addEventListener('open', () => finish(resolve));
      ws.addEventListener('error', (err) => finish(reject, new Error(`WebSocket error: ${err.message || err.type}`)));
    });

    cdp = new CdpConnection(ws);
  } catch (err) {
    await cleanupBrowserProcesses().catch((cleanupErr) => {
      err.message += ` | cleanup error: ${cleanupErr.message}`;
    });
    throw err;
  }

  const GTAG_NOOP_BODY_B64 = Buffer.from('/* e2e noop */\n', 'utf8').toString('base64');

  const newPage = async () => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Network.enable', {}, sessionId);
    await cdp.send('Log.enable', {}, sessionId);

    const requestUrls = new Map();
    const inFlightRequests = new Map();
    let consoleErrors = [];
    let pageExceptions = [];
    let logErrors = [];
    let badResponses = [];
    let networkFailures = [];
    let fetchErrors = [];

    const isBenignFetchError = (err) =>
      /(-32602|Invalid InterceptionId|Target closed|Session closed|CDP connection closed)/i.test(
        String(err?.message || err)
      );

    const GTAG_NOOP_BODY_B64_REF = GTAG_NOOP_BODY_B64;
    const unsubs = [];
    unsubs.push(cdp.on(
      'Fetch.requestPaused',
      (p) => {
        const reqUrl = p.request?.url || '';
        if (/\/metrics\/js\b|googletagmanager\.com/i.test(reqUrl)) {
          cdp
            .send(
              'Fetch.fulfillRequest',
              {
                requestId: p.requestId,
                responseCode: 200,
                responseHeaders: [{ name: 'Content-Type', value: 'application/javascript; charset=utf-8' }],
                body: GTAG_NOOP_BODY_B64_REF
              },
              sessionId,
              30000
            )
            .catch((err) => {
              if (isBenignFetchError(err)) return;
              fetchErrors.push(`Fetch.fulfillRequest(${reqUrl}): ${err?.message || err}`);
              cdp
                .send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'Aborted' }, sessionId, 5000)
                .catch(() => {});
            });
        } else {
          cdp
            .send('Fetch.continueRequest', { requestId: p.requestId }, sessionId, 30000)
            .catch((err) => {
              if (isBenignFetchError(err)) return;
              fetchErrors.push(`Fetch.continueRequest(${reqUrl}): ${err?.message || err}`);
              cdp
                .send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'Aborted' }, sessionId, 5000)
                .catch(() => {});
            });
        }
      },
      sessionId
    ));
    await cdp.send(
      'Fetch.enable',
      {
        patterns: [
          { urlPattern: '*googletagmanager.com*', requestStage: 'Request' },
          { urlPattern: '*/metrics/js*', requestStage: 'Request' }
        ]
      },
      sessionId
    );

    unsubs.push(cdp.on(
      'Runtime.consoleAPICalled',
      (p) => {
        if (p.type === 'error') {
          const text = (p.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ');
          consoleErrors.push(text);
        }
      },
      sessionId
    ));
    unsubs.push(cdp.on(
      'Runtime.exceptionThrown',
      (p) => {
        const desc = p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || 'Uncaught exception';
        pageExceptions.push(desc);
      },
      sessionId
    ));
    unsubs.push(cdp.on(
      'Log.entryAdded',
      (p) => {
        if (p.entry?.level === 'error') {
          logErrors.push(`${p.entry.source || 'log'}: ${p.entry.text}`);
        }
      },
      sessionId
    ));
    unsubs.push(cdp.on(
      'Network.requestWillBeSent',
      (p) => {
        if (p.requestId && p.request?.url) {
          requestUrls.set(p.requestId, p.request.url);
          inFlightRequests.set(p.requestId, p.request.url);
        }
      },
      sessionId
    ));
    unsubs.push(cdp.on(
      'Network.responseReceived',
      (p) => {
        if (p.response && p.response.status >= 400) {
          badResponses.push({ url: p.response.url, status: p.response.status });
        }
      },
      sessionId
    ));
    unsubs.push(cdp.on(
      'Network.loadingFinished',
      (p) => {
        if (p.requestId) inFlightRequests.delete(p.requestId);
      },
      sessionId
    ));
    unsubs.push(cdp.on(
      'Network.loadingFailed',
      (p) => {
        if (p.requestId) inFlightRequests.delete(p.requestId);
        if (!p.canceled) {
          networkFailures.push({
            url: requestUrls.get(p.requestId) || '(unknown)',
            errorText: p.errorText || 'loadingFailed'
          });
        }
      },
      sessionId
    ));

    const setViewport = async ({ width, height, deviceScaleFactor = 1, mobile = false }) => {
      await cdp.send(
        'Emulation.setDeviceMetricsOverride',
        { width, height, deviceScaleFactor, mobile },
        sessionId
      );
    };

    const navigateAndAudit = async (url, originPrefix, waitLoadMs = 45000) => {
      consoleErrors = [];
      pageExceptions = [];
      logErrors = [];
      badResponses = [];
      networkFailures = [];
      fetchErrors = [];
      requestUrls.clear();
      inFlightRequests.clear();

      if (cdp.closed) {
        throw new Error(`CDP connection already closed before navigating to ${url}`);
      }

      const navMarker = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await cdp
        .send(
          'Runtime.evaluate',
          { expression: `window.__e2ePrevNav=${JSON.stringify(navMarker)}` },
          sessionId,
          5000
        )
        .catch(() => {});

      let settled = false;
      let loadResolve;
      let loadReject;
      const loadPromise = new Promise((resolve, reject) => {
        loadResolve = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        loadReject = (err) => {
          if (settled) return;
          settled = true;
          reject(err);
        };
      });

      const unsubLoad = cdp.on('Page.loadEventFired', () => loadResolve(), sessionId);
      const unsubCrash = cdp.on(
        'Inspector.targetCrashed',
        () => loadReject(new Error(`Renderer target crashed while navigating to ${url}`)),
        sessionId
      );
      const unsubClose = cdp.onClose((reason) =>
        loadReject(new Error(`CDP WebSocket closed while navigating to ${url}: ${reason}`))
      );

      let loadTimer;
      let fallbackStartTimer;
      let fallbackPollTimer;
      let pollInFlight = false;

      try {
        const navRes = await cdp.send('Page.navigate', { url }, sessionId, Math.max(30000, waitLoadMs));
        if (navRes?.errorText) {
          throw new Error(`Page.navigate failed for ${url}: ${navRes.errorText}`);
        }

        fallbackStartTimer = setTimeout(() => {
          if (settled || cdp.closed) return;
          fallbackPollTimer = setInterval(async () => {
            if (settled || pollInFlight || cdp.closed) return;
            pollInFlight = true;
            try {
              const evalRes = await cdp.send(
                'Runtime.evaluate',
                {
                  expression: `(() => ({ samePrev: window.__e2ePrevNav === ${JSON.stringify(navMarker)}, readyState: document.readyState, href: location.href }))()`,
                  returnByValue: true
                },
                sessionId,
                3000
              );
              const val = evalRes?.result?.value;
              if (val && val.samePrev === false && val.readyState === 'complete') {
                loadResolve();
              }
            } catch {} finally {
              pollInFlight = false;
            }
          }, 1000);
        }, 4000);

        loadTimer = setTimeout(async () => {
          let diag = { readyState: 'unknown', href: 'unknown' };
          try {
            const r = await cdp.send(
              'Runtime.evaluate',
              { expression: '({ readyState: document.readyState, href: location.href })', returnByValue: true },
              sessionId,
              2000
            );
            if (r?.result?.value) diag = r.result.value;
          } catch {}
          loadReject(
            new Error(
              `Page.loadEventFired timed out (${waitLoadMs}ms) for ${url} [readyState=${diag.readyState}, href=${diag.href}, inFlight=${JSON.stringify([...inFlightRequests.values()].slice(0, 5))}, fetchErrors=${JSON.stringify(fetchErrors)}]`
            )
          );
        }, waitLoadMs);

        await loadPromise;
      } finally {
        settled = true;
        clearTimeout(loadTimer);
        clearTimeout(fallbackStartTimer);
        clearInterval(fallbackPollTimer);
        unsubLoad();
        unsubCrash();
        unsubClose();
      }

      // Allow deferred scripts (nav.js) + fonts + two animation frames to settle
      await cdp.send(
        'Runtime.evaluate',
        {
          expression: `(async () => {
            try { if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1000))]); } catch {}
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            await new Promise(r => setTimeout(r, 150));
          })()`,
          awaitPromise: true,
          returnByValue: true
        },
        sessionId,
        30000
      );

      if (fetchErrors.length > 0) {
        throw new Error(`CDP Fetch interception error(s) for ${url}: ${fetchErrors.join('; ')}`);
      }

      const sameOriginBadResponses = badResponses.filter((r) => r.url.startsWith(originPrefix));
      const sameOriginFailures = networkFailures.filter((r) => r.url.startsWith(originPrefix));

      return {
        consoleErrors: [...consoleErrors],
        pageExceptions: [...pageExceptions],
        logErrors: [...logErrors],
        sameOriginBadResponses,
        sameOriginFailures,
        fetchErrors: [...fetchErrors]
      };
    };

    const evaluate = async (expression) => {
      const res = await cdp.send(
        'Runtime.evaluate',
        { expression, awaitPromise: true, returnByValue: true },
        sessionId,
        30000
      );
      if (res.exceptionDetails) {
        throw new Error(
          `Runtime.evaluate exception: ${res.exceptionDetails.exception?.description || res.exceptionDetails.text}`
        );
      }
      return res.result?.value;
    };

    const closePage = async () => {
      for (const unsub of unsubs) {
        try { unsub(); } catch {}
      }
      requestUrls.clear();
      inFlightRequests.clear();
      await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
    };

    return { targetId, sessionId, setViewport, navigateAndAudit, evaluate, close: closePage };
  };

  const close = async () => {
    if (!cdp.closed) {
      if (process.platform === 'win32' && winHelperExe && proc.exitCode === null) {
        try {
          proc.stdin?.write('GRACEFUL\n');
        } catch {}
      }
      try {
        const tgts = await cdp.send('Target.getTargets', {}, undefined, 3000).catch(() => null);
        if (tgts?.targetInfos) {
          for (const ti of tgts.targetInfos) {
            if (ti.type === 'page') {
              await cdp.send('Target.closeTarget', { targetId: ti.targetId }, undefined, 1000).catch(() => {});
            }
          }
        }
        await cdp.send('Browser.close', {}, undefined, 5000).catch(() => {});
        await waitForProcExit(proc, 12000);
      } catch {}
    }
    await cleanupBrowserProcesses();
  };

  return {
    bin,
    wsUrl,
    proc,
    get rootPid() {
      return rootPid;
    },
    userDataDir,
    newPage,
    close
  };
}
