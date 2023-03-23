// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog, ipcMain, screen } = require('electron');
app.commandLine.appendSwitch("--disable-http-cache");
const path = require('path');
const fs = require('fs');
const {exec} = require('child_process');
const iconPath = path.join(__dirname, 'favicon.ico');
const task_server = require(path.join(__dirname, 'server.js'));

let config = fs.readFileSync(path.join(task_server.getDir(), `config.json`), 'utf8');
config = JSON.parse(config);
task_server.start(config.webserver_port); //start local server
let server_address = `${config.webserver_address}:${config.webserver_port}`;
const websocket_port = 8084; //目前只支持8084端口，写死，因为扩展里面写死了
console.log("server_address: " + server_address);
let driverPath = "";
let chromeBinaryPath = "";
let execute_path = "";
console.log(process.arch);
if (process.platform === 'win32' && process.arch === 'ia32') {
  driverPath = path.join(__dirname, "chrome_win32/chromedriver_win32.exe");
  chromeBinaryPath = path.join(__dirname, "chrome_win32/chrome.exe");
  execute_path = path.join(__dirname, "chrome_win32/execute.bat");
} else if(process.platform === 'win32' && process.arch === 'x64') {
    driverPath = path.join(__dirname, "chrome_win64/chromedriver_win64.exe");
    chromeBinaryPath = path.join(__dirname, "chrome_win64/chrome.exe");
    execute_path = path.join(__dirname, "chrome_win64/execute.bat");
} else if (process.platform === 'darwin') {
  driverPath = path.join(__dirname, "chromedriver_mac64");
  chromeBinaryPath = path.join(__dirname, "chrome_mac64.app/Contents/MacOS/Google Chrome");
  execute_path = path.join(__dirname, "easyspider_executestage");
} else if (process.platform === 'linux') {
  driverPath = path.join(__dirname, "chrome_linux64/chromedriver_linux64");
  chromeBinaryPath = path.join(__dirname, "chrome_linux64/chrome");
  execute_path = path.join(__dirname, "chrome_linux64/execute.sh");
}
console.log(driverPath, chromeBinaryPath, execute_path);
let language = "en";
let driver = null;
let mainWindow = null;
let flowchart_window = null;

// var ffi = require('ffi-napi');
// var libm = ffi.Library('libm', {
//   'ceil': [ 'double', [ 'double' ] ]
// });
// libm.ceil(1.5); // 2
// const {user32FindWindowEx,
//   winspoolGetDefaultPrinter,} = require('win32-api/fun');
// async function testt(){
//   // 获取当前电脑当前用户默认打印机名
//   const printerName = await winspoolGetDefaultPrinter()
//   console.log(printerName);
// }

// testt();

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 520,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, 'src/js/preload.js')
    },
    icon: iconPath,
    // frame: false, //取消window自带的关闭最小化等
    resizable: false //禁止改变主窗口尺寸
  })

  // and load the index.html of the app.
  // mainWindow.loadFile('src/index.html');
    mainWindow.loadURL(server_address + '/index.html?user_data_folder=' + config.user_data_folder);
 // 隐藏菜单栏
 const { Menu } = require('electron');
 Menu.setApplicationMenu(null);
 mainWindow.on('close', function (e) {
   if (process.platform !== 'darwin'){
     app.quit();
   }
 });
  // mainWindow.webContents.openDevTools();
  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}


function beginInvoke(msg) {
  if (msg.type == 1) {
    if (msg.message.id != -1) {
      let url = "";
      if (language == "zh"){
        url = server_address + `/taskGrid/FlowChart_CN.html?id=${msg.message.id}&wsport=${websocket_port}&backEndAddressServiceWrapper=` + server_address;
      } else if(language == "en"){
        url =  server_address + `/taskGrid/FlowChart.html?id=${msg.message.id}&wsport=${websocket_port}&backEndAddressServiceWrapper=` + server_address;
      }
      console.log(url);
      flowchart_window.loadURL(url);
    }
    mainWindow.hide();
    const window = windowManager.getActiveWindow();
  // Prints the currently focused window bounds.
    console.log(window);
  // This method has to be called on macOS before changing the window's bounds, otherwise it will throw an error.
  // It will prompt an accessibility permission request dialog, if needed.
    if(window != undefined){
      windowManager.requestAccessibility();
      // Sets the active window's bounds.
        let size = screen.getPrimaryDisplay().workAreaSize
        let width = parseInt(size.width)
        let height = parseInt(size.height * 0.6)
        window.setBounds({ x: 0, y: size.height * 0.4, height:height, width:width });
    }
    
    flowchart_window.show();
  } else if (msg.type == 2) {
    //keyboard
    const robot = require("@jitsi/robotjs");
    //TODO 实现全选并删除功能,目前没有
    keyInfo = msg.message.keyboardStr.split("BS}")[1];
    robot.keyTap("a", "control");
    robot.keyTap("backspace");
    robot.typeString(keyInfo);
    robot.keyTap("shift");
    robot.keyTap("shift");
  } else if (msg.type == 3) {
    try {
      if (msg.from == 0) {
        socket_flowchart.send(msg.message.pipe); //直接把消息转接
      }
      else {
        socket_window.send(msg.message.pipe);
      }
    } catch {
      dialog.showErrorBox("Error", "Please open the flowchart window first");
    }
  } else if (msg.type == 5){
    var child = require('child_process').execFile;
    // 参数顺序： 1. task id 2. server address 3. saved_file_name 4. "remote" or "local" 5. user_data_folder
    // var parameters = [msg.message.id, server_address];
    let parameters = [];
    console.log(msg.message)
    if(msg.message.user_data_folder == null || msg.message.user_data_folder == undefined || msg.message.user_data_folder == ""){
        parameters = ["--id", msg.message.id, "--server_address", server_address];
    } else {
      let user_data_folder_path = __dirname.indexOf("resources")>=0 && __dirname.indexOf("app")>=0? path.join(__dirname, "../../..", msg.message.user_data_folder): path.join(__dirname, msg.message.user_data_folder);
      parameters = ["--id", msg.message.id, "--server_address", server_address, "--user_data_folder", user_data_folder_path];
      config.user_data_folder = msg.message.user_data_folder;
      fs.writeFileSync(path.join(task_server.getDir(), "config.json"), JSON.stringify(config));
    }
    // child('Chrome/easyspider_executestage.exe', parameters, function(err,stdout, stderr) {
    //    console.log(stdout);
    // });

    let spawn = require("child_process").spawn;
    let child_process = spawn(execute_path, parameters);
    child_process.stdout.on('data', function (data) {
      console.log(data.toString());
    });
  }
}

const WebSocket = require('ws');
let socket_window = null;
let socket_start = null;
let socket_flowchart = null;
var wss = new WebSocket.Server({ port: websocket_port });
wss.on('connection', function (ws) {
  ws.on('message', function (message, isBinary) {
    let msg = JSON.parse(message.toString());
    // console.log(msg, msg.type, msg.message);
    if (msg.type == 0) {
      if (msg.message.id == 0) {
        socket_window = ws;
        console.log("set socket_window")
      }
      else if (msg.message.id == 1) {
        socket_start = ws;
        console.log("set socket_start")
      }
      else if (msg.message.id == 2) {
        socket_flowchart = ws;
        console.log("set socket_flowchart");
      }
    } else {
      beginInvoke(msg);
    }
  });
});

const { Builder, By, Key, until } = require("selenium-webdriver");
const chrome = require('selenium-webdriver/chrome');
const { ServiceBuilder } = require('selenium-webdriver/chrome');
const { rootCertificates } = require('tls');
const { exit } = require('process');
const {windowManager} = require("node-window-manager");

console.log(process.platform);

async function runBrowser(lang="en", user_data_folder='') {
  const serviceBuilder = new ServiceBuilder(driverPath);
  let options = new chrome.Options();
  language = lang;
  if(lang=="en") {
    options.addExtensions(path.join(__dirname, "EasySpider_en.crx"));
  } else if(lang=="zh") {
    options.addExtensions(path.join(__dirname, "EasySpider_zh.crx"));
  }
  options.setChromeBinaryPath(chromeBinaryPath);
  if(user_data_folder != ""){
    let dir = __dirname.indexOf("resources")>=0 && __dirname.indexOf("app")>=0? path.join(__dirname, "../../..", user_data_folder): path.join(__dirname, user_data_folder);
    options.addArguments("--user-data-dir=" + dir);
    config.user_data_folder = user_data_folder;
    fs.writeFileSync(path.join(task_server.getDir(), "config.json"), JSON.stringify(config));
  }
  driver = new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .setChromeService(serviceBuilder)
    .build();
  const cdpConnection = await driver.createCDPConnection("page");
  let stealth_path = path.join(__dirname, "stealth.min.js");
  let stealth = fs.readFileSync(stealth_path, 'utf8');
  await cdpConnection.execute('Page.addScriptToEvaluateOnNewDocument', {
      source: stealth,
    });
  try {
    await driver.get(server_address + "/taskGrid/taskList.html?wsport="+websocket_port+"&backEndAddressServiceWrapper=" + server_address + "&lang=" + lang);
  } finally {
    // await driver.quit(); // 退出浏览器
  }
}

function handleOpenBrowser(event, lang="en", user_data_folder= "") {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  runBrowser(lang, user_data_folder);
  let size = screen.getPrimaryDisplay().workAreaSize;
  let width = parseInt(size.width);
  let height = parseInt(size.height * 0.6);
  flowchart_window = new BrowserWindow({
    x:0,
    y:0,
    width: width,
    height: height,
    icon: iconPath,
  });
  let url = "";
  let id = -1;
  if (lang == "en") {
    url = server_address + `/taskGrid/FlowChart.html?id=${id}&wsport=${websocket_port}&backEndAddressServiceWrapper=` + server_address;
  }else if(lang == "zh") {
    url = server_address + `/taskGrid/FlowChart_CN.html?id=${id}&wsport=${websocket_port}&backEndAddressServiceWrapper=` + server_address;
  }
  // and load the index.html of the app.
  flowchart_window.loadURL(url);
  flowchart_window.hide();
  flowchart_window.on('close', function (event) {
    mainWindow.show();
    driver.quit();
  });
}

function handleOpenInvoke(event, lang="en"){
  const window = new BrowserWindow({icon: iconPath});
  let url = "";
  language = lang;
  if (lang == "en") {
      url = server_address + `/taskGrid/taskList.html?type=1&wsport=${websocket_port}&backEndAddressServiceWrapper=` + server_address;
    }else if(lang == "zh") {
      url = server_address + `/taskGrid/taskList.html?type=1&wsport=${websocket_port}&backEndAddressServiceWrapper=` + server_address + "&lang=zh";
  }
  // and load the index.html of the app.
  window.loadURL(url);
  window.maximize();
  mainWindow.hide();
  window.on('close', function (event) {
    mainWindow.show();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  ipcMain.on('start-design', handleOpenBrowser);
  ipcMain.on('start-invoke', handleOpenInvoke);
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0){
       createWindow();
    }
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin'){
    app.quit();
  } 
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
