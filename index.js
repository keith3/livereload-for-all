#! /usr/bin/env node
var fs = require('fs')
  , argv = require('minimist')(process.argv.slice(2))
  , net = require('net')
  , socket = require('socket.io')
  , proxy = require('http-proxy')
  , connect = require('connect')
  , injector = require('connect-inject')
  , portscanner = require('portscanner')
  , httpServer, socketServer, proxyServer
  , httpServerPort = argv.H || 80
  , socketServerPort = argv.S || 31396
  , proxyServerPort = argv.P || 8090
  , docRoot = argv.D;

if (argv.v) {
    console.log(require('./package.json').version)
    process.exit();
}

if (typeof docRoot == 'undefined') {
    console.log('Miss the DocRoot, for example: livereload -D /var/www/foo');
    process.exit();
}


/**
 * set cli option
 */
opt = require('node-getopt').create([
    ['H' , '', 'http server port, default port is 80'],
    ['P' , '', 'proxy server port, default port is 8090'],
    ['S' , '', 'websocket server port, default port is 31396'],
    ['D' , '', 'http server\'s docRoot'],
    ['h' , '', 'display this help'],
    ['v' , '', 'show version']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line


/**
 * websocket server part
 */
function setSocketServer() {
    socketServer = socket.listen(socketServerPort); 
    console.log(new Date() + 'Livereload server listening on ' + socketServerPort);
    
    fs.watch(docRoot, function() {
        socketServer.emit('reload')
    });
}

/**
 * proxy server part
 */
function setProxyServer() {
    var injectCode = "<script src='http://localhost:" + socketServerPort + "/socket.io/socket.io.js'></script><script>"
                + " var socket = io.connect('http://localhost:" + socketServerPort + "');"
                + " socket.on('reload', function() {location.reload()});"
                + " </script>";
    proxyServer = proxy.createProxyServer({target: 'http://localhost:' + httpServerPort});

    connect.createServer(
        injector({snippet: injectCode}),
        function(req, res) {
            proxyServer.web(req, res);
        }
    ).listen(proxyServerPort);
    console.log(new Date() + 'Proxy server listening on ' + proxyServerPort);
}

/**
 * check if the port is token
 */
// function isPortTaken(port, callback) {
//     var server = net.createServer().listen(port);
    
//     // server.once('error', function(err) {
//     //     if (err.code == 'EADDRINUSE') {
//     //         callback(true);
//     //     }
//     // });
//     process.on('uncaughtException', function(err) {
//         if (err.code === 'EADDRINUSE') {
//             console.log(err.code, port);
//             callback(true);
//         }
//     });
//     server.once('listening', function() {
//         server.close();
//         callback(false);
//     });
//     server.listen(port);
// }

/**
 * check cli arguments
 */
function checkParam(callback) {
    var flag = 0;
    var yes = 0;
    portscanner.checkPortStatus(httpServerPort, '127.0.0.1', function(error, status) {
        // Status is 'open' if currently in use or 'closed' if available
        flag += 1;
        if (status === 'closed') {
            console.log('Error: There is no http server on port ' + httpServerPort + '.');
        } else {
            yes += 1;
        }
        if (flag == 3) {
            if (yes == 3) {
                callback(true);
            } else {
                callback(false);
            }
        } 
    })
    portscanner.checkPortStatus(proxyServerPort, '127.0.0.1', function(error, status) {
        flag += 1;
        if (status === 'open') {
            console.log('Error: Port ' + proxyServerPort + ' is taken by other process.');
        } else {
            yes += 1;
        }
        if (flag == 3) {
            if (yes == 3) {
                callback(true);
            } else {
                callback(false);
            }
        } 
    })
    fs.exists(docRoot, function(result) {
        flag += 1;
        if (! result) {
            console.log('Error: The path didn\'t exists in file system.');
        } else {
            yes += 1;
        }
        if (flag == 3) {
            if (yes == 3) {
                callback(true);
            } else {
                callback(false);
            }
        } 
    });
}

/**
 * start
 */
checkParam(function(result) {
    if (result) {
        setSocketServer();
        setProxyServer();
    } else {
        process.exit();
    }
});
