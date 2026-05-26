#include <napi.h>
#include <windows.h>
#include <unordered_map>

struct EnumByPidContext {
  DWORD pid;
  HWND found;
};

struct EnumByTitleContext {
  std::string needle;
  HWND found;
};

static std::unordered_map<HWND, LONG_PTR> g_originalStyles;

static bool IsMainWindow(HWND hwnd) {
  return GetWindow(hwnd, GW_OWNER) == nullptr && IsWindowVisible(hwnd);
}

static BOOL CALLBACK EnumWindowsByPidProc(HWND hwnd, LPARAM lParam) {
  auto* ctx = reinterpret_cast<EnumByPidContext*>(lParam);
  DWORD winPid = 0;
  GetWindowThreadProcessId(hwnd, &winPid);
  if (winPid == ctx->pid && IsMainWindow(hwnd)) {
    ctx->found = hwnd;
    return FALSE;
  }
  return TRUE;
}

static BOOL CALLBACK EnumWindowsByTitleProc(HWND hwnd, LPARAM lParam) {
  auto* ctx = reinterpret_cast<EnumByTitleContext*>(lParam);
  if (!IsMainWindow(hwnd)) return TRUE;

  char title[512];
  int len = GetWindowTextA(hwnd, title, sizeof(title));
  if (len <= 0) return TRUE;

  std::string t(title, len);
  if (t.find(ctx->needle) != std::string::npos) {
    ctx->found = hwnd;
    return FALSE;
  }
  return TRUE;
}

static HWND ParseHwndArg(const Napi::Value& value) {
  if (value.IsString()) {
    std::string s = value.As<Napi::String>().Utf8Value();
    unsigned long long raw = std::stoull(s, nullptr, 16);
    return reinterpret_cast<HWND>(raw);
  }
  if (value.IsBigInt()) {
    bool lossless = false;
    uint64_t raw = value.As<Napi::BigInt>().Uint64Value(&lossless);
    return reinterpret_cast<HWND>(raw);
  }
  return nullptr;
}

static Napi::Value FindWindowByPid(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "pid number is required").ThrowAsJavaScriptException();
    return env.Null();
  }

  DWORD pid = static_cast<DWORD>(info[0].As<Napi::Number>().Uint32Value());
  EnumByPidContext ctx{pid, nullptr};
  EnumWindows(EnumWindowsByPidProc, reinterpret_cast<LPARAM>(&ctx));

  if (!ctx.found) {
    return env.Null();
  }

  unsigned long long raw = reinterpret_cast<unsigned long long>(ctx.found);
  char buffer[32];
  sprintf_s(buffer, "%llx", raw);
  return Napi::String::New(env, buffer);
}

static Napi::Value FindWindowByTitleContains(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "title needle string is required").ThrowAsJavaScriptException();
    return env.Null();
  }

  EnumByTitleContext ctx{info[0].As<Napi::String>().Utf8Value(), nullptr};
  EnumWindows(EnumWindowsByTitleProc, reinterpret_cast<LPARAM>(&ctx));
  if (!ctx.found) return env.Null();

  unsigned long long raw = reinterpret_cast<unsigned long long>(ctx.found);
  char buffer[32];
  sprintf_s(buffer, "%llx", raw);
  return Napi::String::New(env, buffer);
}

static Napi::Value AttachWindow(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2) {
    Napi::TypeError::New(env, "childHwnd and parentHwnd are required").ThrowAsJavaScriptException();
    return env.Null();
  }

  HWND child = ParseHwndArg(info[0]);
  HWND parent = ParseHwndArg(info[1]);
  if (!child || !parent) {
    Napi::TypeError::New(env, "invalid hwnd").ThrowAsJavaScriptException();
    return env.Null();
  }

  HWND result = SetParent(child, parent);
  if (!result) {
    DWORD err = GetLastError();
    Napi::Error::New(env, "SetParent failed: " + std::to_string(err)).ThrowAsJavaScriptException();
    return env.Null();
  }

  SetWindowPos(child, nullptr, 0, 0, 100, 100, SWP_NOZORDER | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
  return Napi::Boolean::New(env, true);
}

static Napi::Value SetChildStyle(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1) {
    Napi::TypeError::New(env, "childHwnd is required").ThrowAsJavaScriptException();
    return env.Null();
  }

  HWND child = ParseHwndArg(info[0]);
  if (!child) {
    Napi::TypeError::New(env, "invalid hwnd").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (g_originalStyles.find(child) == g_originalStyles.end()) {
    g_originalStyles[child] = GetWindowLongPtr(child, GWL_STYLE);
  }

  LONG_PTR style = GetWindowLongPtr(child, GWL_STYLE);
  style &= ~(WS_POPUP | WS_CAPTION | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU);
  style |= WS_CHILD | WS_VISIBLE;
  SetWindowLongPtr(child, GWL_STYLE, style);
  SetWindowPos(child, nullptr, 0, 0, 100, 100, SWP_NOZORDER | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
  return Napi::Boolean::New(env, true);
}

static Napi::Value MoveEmbeddedWindow(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 5) {
    Napi::TypeError::New(env, "hwnd, x, y, width, height are required").ThrowAsJavaScriptException();
    return env.Null();
  }

  HWND hwnd = ParseHwndArg(info[0]);
  int x = info[1].As<Napi::Number>().Int32Value();
  int y = info[2].As<Napi::Number>().Int32Value();
  int w = info[3].As<Napi::Number>().Int32Value();
  int h = info[4].As<Napi::Number>().Int32Value();

  if (!hwnd) {
    Napi::TypeError::New(env, "invalid hwnd").ThrowAsJavaScriptException();
    return env.Null();
  }

  BOOL ok = MoveWindow(hwnd, x, y, w, h, TRUE);
  if (!ok) {
    DWORD err = GetLastError();
    Napi::Error::New(env, "MoveWindow failed: " + std::to_string(err)).ThrowAsJavaScriptException();
    return env.Null();
  }
  return Napi::Boolean::New(env, true);
}

static Napi::Value DetachWindow(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1) {
    Napi::TypeError::New(env, "hwnd is required").ThrowAsJavaScriptException();
    return env.Null();
  }

  HWND child = ParseHwndArg(info[0]);
  if (!child) {
    Napi::TypeError::New(env, "invalid hwnd").ThrowAsJavaScriptException();
    return env.Null();
  }

  SetParent(child, nullptr);
  auto it = g_originalStyles.find(child);
  if (it != g_originalStyles.end()) {
    SetWindowLongPtr(child, GWL_STYLE, it->second);
    g_originalStyles.erase(it);
  } else {
    LONG_PTR style = GetWindowLongPtr(child, GWL_STYLE);
    style &= ~WS_CHILD;
    style |= WS_OVERLAPPEDWINDOW;
    SetWindowLongPtr(child, GWL_STYLE, style);
  }
  SetWindowPos(child, nullptr, 100, 100, 900, 700, SWP_NOZORDER | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
  return Napi::Boolean::New(env, true);
}

static Napi::Value IsWindowAlive(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1) {
    Napi::TypeError::New(env, "hwnd is required").ThrowAsJavaScriptException();
    return env.Null();
  }

  HWND hwnd = ParseHwndArg(info[0]);
  if (!hwnd) return Napi::Boolean::New(env, false);
  return Napi::Boolean::New(env, IsWindow(hwnd) ? true : false);
}

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "findWindowByPid"), Napi::Function::New(env, FindWindowByPid));
  exports.Set(Napi::String::New(env, "findWindowByTitleContains"), Napi::Function::New(env, FindWindowByTitleContains));
  exports.Set(Napi::String::New(env, "setChildStyle"), Napi::Function::New(env, SetChildStyle));
  exports.Set(Napi::String::New(env, "attachWindow"), Napi::Function::New(env, AttachWindow));
  exports.Set(Napi::String::New(env, "moveEmbeddedWindow"), Napi::Function::New(env, MoveEmbeddedWindow));
  exports.Set(Napi::String::New(env, "detachWindow"), Napi::Function::New(env, DetachWindow));
  exports.Set(Napi::String::New(env, "isWindowAlive"), Napi::Function::New(env, IsWindowAlive));
  return exports;
}

NODE_API_MODULE(winembed, Init)
