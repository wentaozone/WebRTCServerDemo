const ClientModel = require("./ClientModel");

module.exports = function(io) {

  var mSockets = [];
  var groups = new Map();

  let clientType_Taurus = 'taurus';
  let clientType_Virgo = 'virgo';

  io.on('connection', function(client) {
    let clientId = client.id;

    console.log('-- ' + clientId + ' joined --');
    mSockets.push(client);
    client.emit('id', clientId);





    client.on('search', function (data) {
        handleSearch(data);
    });

    client.on('init', function (data) {
        handleInit(data);
    });

    client.on('message', function (data) {
        handleSignalingMessage(data);
    });

    function handleInit(data){
        let groupName = data.group;
        let clientType = data.clientType;
        if (clientType !== clientType_Taurus || clientType !== clientType_Virgo) {
            return;
        }
        
        var group = groups.get(groupName);
        var taurusMap;
        var virgoMap;
        if (!group) {
            group = new Map();
            taurusMap = new Map();
            virgoMap = new Map();
            group.set(clientType_Taurus, taurusMap);
            group.set(clientType_Virgo, virgoMap);
            groups.set(groupName, group);
        }
        
        let clientModel = new ClientModel(groupName, clientId, clientType);
        if (clientType == clientType_Taurus) {
            taurusMap.set(clientId, clientModel);
        }
        else if (clientType == clientType_Virgo) {
            virgoMap.set(clientId, clientModel);
        }


        console.log('-- clientId: ' + client.id + ' init');
        for (var i = 0; i < mSockets.length; i++) {
          var otherClient = mSockets[i];
          if (client.id != otherClient.id) {
            otherClient.emit('message',  {
                type: "init",
                from: client.id,
                clientType: clientType,
                group: group
            });
          }
        }
    }
//  private tool method
    function getOtherClients(groupName, clientType){
      let group = groups.get(groupName);
      var otherClientMap;
      if (clientType == clientType_Taurus) {
        otherClientMap = group.get(clientType_Virgo);
      }
      else if (clientType == clientType_Virgo) {
        otherClientMap = group.get(clientType_Taurus);
      }
      return otherClientMap;
    }
// webSocket 处理函数
    function handleSearch(data){
      let groupName = data.group;
      let clientId = data.from;
      let clientType = data.clientType;
      
      if (clientType !== clientType_Taurus) {
          return;
      }
      // 有新加进来的Virgo也需要告知， 暂时不处理
      // 返回当前已经在线的Virgo列表
      let others = getOtherClients(groupName, clientType);
      client.emit('searchResult', others);
    }

    function handleSignalingMessage(details){
      let groupName = details.group;
      let clientType = details.clientType;
      let clientId = details.from;
      let otherId = details.to;
      let type = details.type;

      // console.log('-- ' + client.id + ' message --' + JSON.stringify(details));
      console.log('-- clientId: ' + clientId + ' type: ' + type);

      var otherClientMap =  getOtherClients(groupName, clientType);           
      for (const key of otherClientMap.keys()) {
        if (key !== clientId) {
          let other = otherClientMap.get(key);
          sendMessageToOther(other.id, details);
        }
      }

      // var otherClient = io.sockets.connected[details.to];
      // if (!otherClient) {
      //   console.log(' ---' + client.id + 'message -- to' + details.to)
      //   return;
      // }
      // delete details.to;
      // otherClient.emit('message', details);
    }

    function sendMessageToOther(to, message) {
      let sc = io.sockets.connected[to];
      if (!sc) {
        console.log("错误 --- 未找到目标socket: " + to);
        return;
      }
      console.log("-- sendToOther: " + to);
      sc.emit("message", message);
    }

    
    
    
    

    function leave() {
      console.log('-- ' + client.id + ' left --');
      var index = 0;
      while (index < mSockets.length && mSockets[index].id != client.id) {
          index++;
      }
      mSockets.splice(index, 1);

    }

    client.on('disconnect', leave);
    client.on('leave', leave);
  });
};