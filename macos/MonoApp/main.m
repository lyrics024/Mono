#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

@interface AppDelegate : NSObject <NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler>
@property(nonatomic, strong) NSWindow *window;
@property(nonatomic, strong) WKWebView *webView;
@property(nonatomic, strong) NSURL *appSupportDirectory;
@property(nonatomic, strong) NSDate *lastBackupRotationDate;
@end

@implementation AppDelegate

- (instancetype)init {
  self = [super init];
  if (self) {
    NSURL *base = [NSFileManager.defaultManager URLsForDirectory:NSApplicationSupportDirectory inDomains:NSUserDomainMask].firstObject;
    _appSupportDirectory = [base URLByAppendingPathComponent:@"Mono" isDirectory:YES];
  }
  return self;
}

- (NSURL *)autoBackupURL {
  return [self.appSupportDirectory URLByAppendingPathComponent:@"mono-auto-backup.json"];
}

- (NSURL *)rotatedBackupURLAtIndex:(NSInteger)index {
  return [self.appSupportDirectory URLByAppendingPathComponent:[NSString stringWithFormat:@"mono-auto-backup.%ld.json", (long)index]];
}

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
  [self makeMainMenu];
  [self createApplicationSupportDirectory];

  WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
  config.websiteDataStore = WKWebsiteDataStore.defaultDataStore;
  config.preferences.javaScriptCanOpenWindowsAutomatically = YES;
  if (@available(macOS 11.0, *)) {
    config.defaultWebpagePreferences.allowsContentJavaScript = YES;
  }

  WKUserContentController *controller = [[WKUserContentController alloc] init];
  WKUserScript *script = [[WKUserScript alloc] initWithSource:[self nativeBootstrapScript]
                                                injectionTime:WKUserScriptInjectionTimeAtDocumentStart
                                             forMainFrameOnly:YES];
  [controller addUserScript:script];
  [controller addScriptMessageHandler:self name:@"monoBackup"];
  [controller addScriptMessageHandler:self name:@"monoExport"];
  config.userContentController = controller;

  self.webView = [[WKWebView alloc] initWithFrame:NSZeroRect configuration:config];
  self.webView.navigationDelegate = self;
  self.webView.UIDelegate = self;
  self.webView.allowsBackForwardNavigationGestures = YES;

  self.window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0, 0, 1200, 860)
                                           styleMask:NSWindowStyleMaskTitled |
                                                     NSWindowStyleMaskClosable |
                                                     NSWindowStyleMaskMiniaturizable |
                                                     NSWindowStyleMaskResizable |
                                                     NSWindowStyleMaskFullSizeContentView
                                             backing:NSBackingStoreBuffered
                                               defer:NO];
  self.window.title = @"Mono";
  self.window.minSize = NSMakeSize(820, 680);
  self.window.contentView = self.webView;
  [self.window center];
  [self.window makeKeyAndOrderFront:nil];
  [NSApp activateIgnoringOtherApps:YES];

  [self loadBundledApp];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
  return YES;
}

- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
  if ([message.name isEqualToString:@"monoBackup"] && [message.body isKindOfClass:NSString.class]) {
    [self writeAutoBackup:(NSString *)message.body];
    return;
  }

  if ([message.name isEqualToString:@"monoExport"] && [message.body isKindOfClass:NSDictionary.class]) {
    NSDictionary *body = (NSDictionary *)message.body;
    NSString *json = [body[@"json"] isKindOfClass:NSString.class] ? body[@"json"] : nil;
    NSString *filename = [body[@"filename"] isKindOfClass:NSString.class] ? body[@"filename"] : [self defaultExportFilename];
    if (json) {
      [self presentSavePanelWithFilename:filename json:json];
    }
  }
}

- (void)webView:(WKWebView *)webView
runOpenPanelWithParameters:(WKOpenPanelParameters *)parameters
initiatedByFrame:(WKFrameInfo *)frame
completionHandler:(void (^)(NSArray<NSURL *> * _Nullable URLs))completionHandler {
  NSOpenPanel *panel = [NSOpenPanel openPanel];
  panel.allowsMultipleSelection = parameters.allowsMultipleSelection;
  panel.canChooseFiles = YES;
  panel.canChooseDirectories = parameters.allowsDirectories;
  [panel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse response) {
    completionHandler(response == NSModalResponseOK ? panel.URLs : nil);
  }];
}

- (void)webView:(WKWebView *)webView
runJavaScriptAlertPanelWithMessage:(NSString *)message
initiatedByFrame:(WKFrameInfo *)frame
completionHandler:(void (^)(void))completionHandler {
  NSAlert *alert = [[NSAlert alloc] init];
  alert.messageText = message;
  [alert addButtonWithTitle:@"好"];
  [alert beginSheetModalForWindow:self.window completionHandler:^(__unused NSModalResponse response) {
    completionHandler();
  }];
}

- (void)webView:(WKWebView *)webView
runJavaScriptConfirmPanelWithMessage:(NSString *)message
initiatedByFrame:(WKFrameInfo *)frame
completionHandler:(void (^)(BOOL result))completionHandler {
  NSAlert *alert = [[NSAlert alloc] init];
  alert.messageText = message;
  [alert addButtonWithTitle:@"确定"];
  [alert addButtonWithTitle:@"取消"];
  [alert beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse response) {
    completionHandler(response == NSAlertFirstButtonReturn);
  }];
}

- (void)loadBundledApp {
  NSURL *indexURL = [NSBundle.mainBundle URLForResource:@"index"
                                          withExtension:@"html"
                                           subdirectory:@"mono-pwa"];
  NSURL *resourcesURL = NSBundle.mainBundle.resourceURL;
  NSURL *webRootURL = [resourcesURL URLByAppendingPathComponent:@"mono-pwa" isDirectory:YES];

  if (!indexURL || !resourcesURL) {
    [self showNativeError:@"无法找到打包后的 mono-pwa/index.html"];
    return;
  }

  [self.webView loadFileURL:indexURL allowingReadAccessToURL:webRootURL];
}

- (void)makeMainMenu {
  NSMenu *mainMenu = [[NSMenu alloc] initWithTitle:@""];
  NSMenuItem *appMenuItem = [[NSMenuItem alloc] initWithTitle:@"" action:nil keyEquivalent:@""];
  [mainMenu addItem:appMenuItem];

  NSMenu *appMenu = [[NSMenu alloc] initWithTitle:@""];
  [appMenu addItemWithTitle:@"关于 Mono" action:@selector(orderFrontStandardAboutPanel:) keyEquivalent:@""];
  [appMenu addItem:NSMenuItem.separatorItem];
  [appMenu addItemWithTitle:@"退出 Mono" action:@selector(terminate:) keyEquivalent:@"q"];
  appMenuItem.submenu = appMenu;

  NSMenuItem *editMenuItem = [[NSMenuItem alloc] initWithTitle:@"" action:nil keyEquivalent:@""];
  [mainMenu addItem:editMenuItem];

  NSMenu *editMenu = [[NSMenu alloc] initWithTitle:@"编辑"];
  [editMenu addItemWithTitle:@"撤销" action:@selector(undo:) keyEquivalent:@"z"];
  [editMenu addItemWithTitle:@"重做" action:@selector(redo:) keyEquivalent:@"Z"];
  [editMenu addItem:NSMenuItem.separatorItem];
  [editMenu addItemWithTitle:@"剪切" action:@selector(cut:) keyEquivalent:@"x"];
  [editMenu addItemWithTitle:@"复制" action:@selector(copy:) keyEquivalent:@"c"];
  [editMenu addItemWithTitle:@"粘贴" action:@selector(paste:) keyEquivalent:@"v"];
  [editMenu addItemWithTitle:@"全选" action:@selector(selectAll:) keyEquivalent:@"a"];
  editMenuItem.submenu = editMenu;

  NSApp.mainMenu = mainMenu;
}

- (void)createApplicationSupportDirectory {
  NSError *error = nil;
  [NSFileManager.defaultManager createDirectoryAtURL:self.appSupportDirectory
                         withIntermediateDirectories:YES
                                          attributes:nil
                                               error:&error];
  if (error) {
    [self showNativeError:[NSString stringWithFormat:@"无法创建本地数据目录：%@", error.localizedDescription]];
  }
}

- (NSString *)nativeBootstrapScript {
  return [NSString stringWithFormat:
    @"window.__MONO_MAC_APP__ = true;\nwindow.__MONO_NATIVE_BACKUP_JSON__ = %@;",
    [self javaScriptStringLiteral:[self readAutoBackup]]
  ];
}

- (NSString *)readAutoBackup {
  return [NSString stringWithContentsOfURL:self.autoBackupURL encoding:NSUTF8StringEncoding error:nil];
}

- (void)writeAutoBackup:(NSString *)json {
  NSError *error = nil;
  [NSFileManager.defaultManager createDirectoryAtURL:self.appSupportDirectory
                         withIntermediateDirectories:YES
                                          attributes:nil
                                               error:&error];
  if (!error) {
    [self rotateAutoBackupsIfNeeded];
    [json writeToURL:self.autoBackupURL atomically:YES encoding:NSUTF8StringEncoding error:&error];
  }
  if (error) {
    [self notifyWeb:@"自动备份失败"];
  }
}

- (void)rotateAutoBackupsIfNeeded {
  BOOL hasCurrentBackup = [NSFileManager.defaultManager fileExistsAtPath:self.autoBackupURL.path];
  if (!hasCurrentBackup) return;

  if (self.lastBackupRotationDate && fabs(self.lastBackupRotationDate.timeIntervalSinceNow) < 60) {
    return;
  }

  NSFileManager *fm = NSFileManager.defaultManager;
  for (NSInteger index = 4; index >= 1; index--) {
    NSURL *fromURL = index == 1 ? self.autoBackupURL : [self rotatedBackupURLAtIndex:index - 1];
    NSURL *toURL = [self rotatedBackupURLAtIndex:index];
    if (![fm fileExistsAtPath:fromURL.path]) continue;

    [fm removeItemAtURL:toURL error:nil];
    [fm moveItemAtURL:fromURL toURL:toURL error:nil];
  }

  self.lastBackupRotationDate = NSDate.date;
}

- (void)presentSavePanelWithFilename:(NSString *)filename json:(NSString *)json {
  NSSavePanel *panel = [NSSavePanel savePanel];
  panel.nameFieldStringValue = filename;
  panel.allowedFileTypes = @[@"json"];
  panel.canCreateDirectories = YES;
  [panel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse response) {
    if (response != NSModalResponseOK || !panel.URL) return;

    NSError *error = nil;
    [json writeToURL:panel.URL atomically:YES encoding:NSUTF8StringEncoding error:&error];
    [self notifyWeb:error ? @"导出失败" : @"数据已导出"];
  }];
}

- (NSString *)defaultExportFilename {
  NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
  formatter.dateFormat = @"yyyy-MM-dd";
  return [NSString stringWithFormat:@"mono_backup_%@.json", [formatter stringFromDate:NSDate.date]];
}

- (void)notifyWeb:(NSString *)message {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSString *literal = [self javaScriptStringLiteral:message];
    [self.webView evaluateJavaScript:[NSString stringWithFormat:@"if (window.showToast) showToast(%@);", literal]
                    completionHandler:nil];
  });
}

- (void)showNativeError:(NSString *)message {
  NSAlert *alert = [[NSAlert alloc] init];
  alert.alertStyle = NSAlertStyleCritical;
  alert.messageText = @"Mono 启动失败";
  alert.informativeText = message;
  [alert runModal];
}

- (NSString *)javaScriptStringLiteral:(NSString *)value {
  if (!value) return @"null";

  NSError *error = nil;
  NSData *data = [NSJSONSerialization dataWithJSONObject:@[value] options:0 error:&error];
  if (error || !data) return @"null";

  NSString *arrayLiteral = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
  return [NSString stringWithFormat:@"(%@)[0]", arrayLiteral];
}

@end

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    NSApplication *app = NSApplication.sharedApplication;
    AppDelegate *delegate = [[AppDelegate alloc] init];
    app.delegate = delegate;
    [app run];
  }
  return 0;
}
