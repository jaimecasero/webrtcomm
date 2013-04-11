/**
 * @class WebRTCommCall
 * @classdesc Main class of the WebRTComm Framework providing high level communication management: 
 *            ringing, ringing back, accept, reject, cancel, bye 
 * @constructor
 * @public
 * @param  {WebRTCommClient} webRTCommClient client owner 
 * @author Laurent STRULLU (laurent.strullu@orange.com) 
 */ 
WebRTCommCall = function(webRTCommClient)
{
    if(webRTCommClient instanceof WebRTCommClient)
    {
        console.debug("WebRTCommCall:WebRTCommCall()");
        this.id=undefined;
        this.webRTCommClient=webRTCommClient;
        this.calleePhoneNumber = undefined;
        this.callerPhoneNumber = undefined;
        this.callerDisplayName=undefined;
        this.incomingCallFlag = false;
        this.configuration=undefined;
        this.connector=undefined;
        this.peerConnection = undefined;
        this.peerConnectionState = undefined;
        this.remoteMediaStream=undefined; 
        this.remoteSdpOffer=undefined;
        this.messageChannel=undefined;
    }
    else 
    {
        throw "WebRTCommCall:WebRTCommCall(): bad arguments"      
    }
};

/**
 * Audio Codec Name 
 * @private
 * @constant
 */ 
WebRTCommCall.prototype.codecNames={
    0:"PCMU", 
    8:"PCMA"
};

/**
 * Get opened/closed status 
 * @public
 * @returns {boolean} true if opened, false if closed
 */
WebRTCommCall.prototype.isOpened=function(){
    if(this.connector) return this.connector.isOpened();
    else return false;   
}

/**
 * Get incoming call status 
 * @public
 * @returns {boolean} true if incoming, false if outgoing
 */
WebRTCommCall.prototype.isIncoming=function(){
    if(this.isOpened())
    {
        return this.incomingCallFlag;
    }
    else
    {   
        console.error("WebRTCommCall:isIncoming(): bad state, unauthorized action");
        throw "WebRTCommCall:isIncoming(): bad state, unauthorized action";    
    } 
}



/**
 * Get call ID
 * @public
 * @returns {String} id  
 */ 
WebRTCommCall.prototype.getId= function() {
    return this.id;  
}

/**
 * Get caller phone number
 * @public
 * @returns {String} callerPhoneNumber or undefined
 */ 
WebRTCommCall.prototype.getCallerPhoneNumber= function() {
    return this.callerPhoneNumber;
}

/**
 * Get caller display Name
 * @public
 * @returns {String} callerDisplayName or undefined
 */ 
WebRTCommCall.prototype.getCallerDisplayName= function() {
    return this.callerDisplayName;
}

/**
 * Get client configuration
 * @public
 * @returns {object} configuration or undefined
 */
WebRTCommCall.prototype.getConfiguration=function(){
    return this.configuration;  
}


/**
 * Get callee phone number
 * @public
 * @return  {String} calleePhoneNumber or undefined
 */ 
WebRTCommCall.prototype.getCalleePhoneNumber= function() {
    return this.calleePhoneNumber;
}

/**
 * get remote media stream
 * @public
 * @return remoteMediaStream RemoteMediaStream or undefined
 */ 
WebRTCommCall.prototype.getRemoteMediaStream= function() {
    return this.remoteMediaStream;
}

/**
 * Open WebRTC communication,  asynchronous action, opened or error event are notified to the WebRTCommClient eventListener
 * @public 
 * @param {String} calleePhoneNumber callee phone number (bob@sip.net)
 * @param {object} configuration communication configuration JSON object
 * <p> Communication configuration sample: <br>
 * { <br>
 * <span style="margin-left: 30px">displayName:alice,<br></span>
 * <span style="margin-left: 30px">localMediaStream: [LocalMediaStream],<br></span>
 * <span style="margin-left: 30px">audioMediaFlag:true,<br></span>
 * <span style="margin-left: 30px">videoMediaFlag:false,<br></span>
 * <span style="margin-left: 30px">messageMediaFlag:false,<br></span>
 * <span style="margin-left: 30px">audioCodecsFilter:PCMA,PCMU,OPUS,<br></span>
 * <span style="margin-left: 30px">videoCodecsFilter:VP8,H264,<br></span>
 * }<br>
 * </p>
 * @throw {String} Exception "bad argument, check API documentation"
 * @throw {String} Exception "bad configuration, missing parameter"
 * @throw {String} Exception "bad state, unauthorized action"
 * @throw {String} Exception internal error
 */ 
WebRTCommCall.prototype.open=function(calleePhoneNumber, configuration){
    console.debug("WebRTCommCall:open():calleePhoneNumber="+calleePhoneNumber);
    console.debug("WebRTCommCall:open():configuration="+ JSON.stringify(configuration));
    if(typeof(configuration) == 'object')
    {
        if(this.webRTCommClient.isOpened())
        {
            if(this.checkConfiguration(configuration))
            {
                if(this.isOpened()==false)
                {
                    try
                    {
                        this.calleePhoneNumber=calleePhoneNumber;
                        this.configuration=configuration; 
                        this.connector.open(configuration);
                    
                        // Setup RTCPeerConnection first
                        this.createRTCPeerConnection();
                        this.peerConnection.addStream(this.configuration.localMediaStream);
                        var that=this;
                        var mediaContraints = {
                            mandatory:
                            {
                                OfferToReceiveAudio:this.configuration.audioMediaFlag, 
                                OfferToReceiveVideo:this.configuration.videoMediaFlag
                            }
                        };
                        
                        if(this.configuration.messageMediaFlag)
                        {
                            if(this.peerConnection.createDataChannel) 
                            {
                                try
                                {
                                    this.messageChannel = this.peerConnection.createDataChannel("mymessageChannel",{
                                        reliable: false
                                    }); 
                                    console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnMessageEvent(): this.messageChannel.label="+this.messageChannel.label); 
                                    console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnMessageEvent(): this.messageChannel.reliable="+this.messageChannel.reliable); 
                                    console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnMessageEvent(): this.messageChannel.binaryType="+this.messageChannel.binaryType);
                                    var that=this;
                                    this.messageChannel.onopen = function(event) {
                                        that.onRtcPeerConnectionMessageChannelOnOpenEvent(event);
                                    }  
                                    this.messageChannel.onclose = function(event) {
                                        that.onRtcPeerConnectionMessageChannelOnClose(event);
                                    }  
                                    this.messageChannel.onerror = function(event) {
                                        that.onRtcPeerConnectionMessageChannelOnErrorEvent(event);
                                    } 
                                    this.messageChannel.onmessage = function(event) {
                                        that.onRtcPeerConnectionMessageChannelOnMessageEvent(event);
                                    }  
                                }
                                catch(exception)
                                {
                                    alert("DataChannel not supported") 
                                }
                            }
                        }
                        
                        if(window.webkitRTCPeerConnection)
                        {
                            this.peerConnection.createOffer(function(offer) {
                                that.onRtcPeerConnectionCreateOfferSuccessEvent(offer);
                            }, function(error) {
                                that.onRtcPeerConnectionCreateOfferErrorEvent(error);
                            },mediaContraints); 
                        }
                        else if(window.mozRTCPeerConnection)
                        {
                            this.peerConnection.createOffer(function(offer) {
                                that.onRtcPeerConnectionCreateOfferSuccessEvent(offer);
                            }, function(error) {
                                that.onRtcPeerConnectionCreateOfferErrorEvent(error);
                            },mediaContraints); 
                        } 
                        console.debug("WebRTCommCall:open():mediaContraints="+ JSON.stringify(mediaContraints));
                    }
                    catch(exception){
                        console.error("WebRTCommCall:open(): catched exception:"+exception);
                        setTimeout(function(){
                            try {
                                that.webRTCommClient.eventListener.onWebRTCommCallOpenErrorEvent(that,exception);
                            }
                            catch(exception)
                            {
                                console.error("WebRTCommCall:onPrivateCallConnectorCallOpenErrorEvent(): catched exception in listener:"+exception);    
                            }
                        },1);
                        // Close properly the communication
                        try {
                            
                            this.close();
                        } catch(e) {} 
                        throw exception;  
                    } 
                }
                else
                {   
                    console.error("WebRTCommCall:open(): bad state, unauthorized action");
                    throw "WebRTCommCall:open(): bad state, unauthorized action";    
                }
            } 
            else
            {
                console.error("WebRTCommCall:open(): bad configuration");
                throw "WebRTCommCall:open(): bad configuration";   
            }
        }
        else
        {   
            console.error("WebRTCommCall:open(): bad state, unauthorized action");
            throw "WebRTCommCall:open(): bad state, unauthorized action";    
        }
    }
    else
    {   
        console.error("WebRTCommCall:open(): bad argument, check API documentation");
        throw "WebRTCommCall:open(): bad argument, check API documentation"    
    }
}  


/**
 * Close WebRTC communication, asynchronous action, closed event are notified to the WebRTCommClient eventListener
 * @public 
 * @throw {String} Exception "bad state, unauthorized action"
 */ 
WebRTCommCall.prototype.close =function(){
    console.debug("WebRTCommCall:close()");
    if(this.webRTCommClient.isOpened())
    {
        try
        {
            // Close private Call Connector
            if(this.connector) 
            {
                this.connector.close();
            }
            
            // Close RTCPeerConnection
            if(this.peerConnection && this.peerConnection.signalingState!='closed') 
            {
                if(this.messageChannel) this.messageChannel.close();
                this.peerConnection.close();
                this.peerConnection=undefined;
                // Notify asynchronously the closed event
                var that=this;
                setTimeout(function(){
                    that.webRTCommClient.eventListener.onWebRTCommCallClosedEvent(that);
                },1);
            }
        }
        catch(exception){
            console.error("WebRTCommCall:open(): catched exception:"+exception);
        }     
    }
    else
    {   
        console.error("WebRTCommCall:close(): bad state, unauthorized action");
        throw "WebRTCommCall:close(): bad state, unauthorized action";    
    }
}

/**
 * Accept incoming WebRTC communication
 * @public 
 * @param {object} configuration communication configuration JSON object
 * <p> Communication configuration sample: <br>
 * { <br>
 * <span style="margin-left: 30px">displayName:alice,<br></span>
 * <span style="margin-left: 30px">localMediaStream: [LocalMediaStream],<br></span>
 * <span style="margin-left: 30px">audioMediaFlag:true,<br></span>
 * <span style="margin-left: 30px">videoMediaFlag:false,<br></span>
 * <span style="margin-left: 30px">messageMediaFlag:false,<br></span>
 * <span style="margin-left: 30px">audioCodecsFilter:PCMA,PCMU,OPUS,<br></span>
 * <span style="margin-left: 30px">videoCodecsFilter:VP8,H264,<br></span>
 * }<br>
 * </p>
 * @throw {String} Exception "bad state, unauthorized action"
 * @throw {String} Exception "internal error,check console logs"
 */ 
WebRTCommCall.prototype.accept =function(configuration){
    console.debug("WebRTCommCall:accept():configuration="+ JSON.stringify(configuration));
    if(typeof(configuration) == 'object')
    {
        if(this.webRTCommClient.isOpened())
        {
            if(this.checkConfiguration(configuration))
            {
                this.configuration = configuration;
                if(this.isOpened()==false)
                {
                    try
                    {
                        this.createRTCPeerConnection();
                        this.peerConnection.addStream(this.configuration.localMediaStream);
                        var sdpOffer=undefined;
                        if(window.webkitRTCPeerConnection)
                        {
                            sdpOffer = new RTCSessionDescription({
                                type: 'offer',
                                sdp: this.remoteSdpOffer
                            });
                        }
                        else if(window.mozRTCPeerConnection)
                        {
                            sdpOffer = new mozRTCSessionDescription({
                                type: 'offer',
                                sdp: this.remoteSdpOffer
                            });
                        }
                        var that=this;
                        this.peerConnectionState = 'offer-received';
                        this.peerConnection.setRemoteDescription(sdpOffer, function() {
                            that.onRtcPeerConnectionSetRemoteDescriptionSuccessEvent();
                        }, function(error) {
                            that.onRtcPeerConnectionSetRemoteDescriptionErrorEvent(error);
                        });
                    }
                    catch(exception){
                        console.error("WebRTCommCall:accept(): catched exception:"+exception);
                        // Close properly the communication
                        try {
                            this.close();
                        } catch(e) {} 
                        throw exception;  
                    }
                }
                else
                {
                    console.error("WebRTCommCall:accept(): bad state, unauthorized action");
                    throw "WebRTCommCall:accept(): bad state, unauthorized action";        
                }
            }
            else
            {
                console.error("WebRTCommCall:accept(): bad configuration");
                throw "WebRTCommCall:accept(): bad configuration";   
            }
        }
        else
        {
            console.error("WebRTCommCall:accept(): bad state, unauthorized action");
            throw "WebRTCommCall:accept(): bad state, unauthorized action";        
        }
    }
    else
    {   
        // Client closed
        console.error("WebRTCommCall:accept(): bad argument, check API documentation");
        throw "WebRTCommCall:accept(): bad argument, check API documentation"    
    }
}

/**
 * Reject/refuse incoming WebRTC communication
 * @public 
 * @throw {String} Exception "bad state, unauthorized action"
 * @throw {String} Exception "internal error,check console logs"
 */ 
WebRTCommCall.prototype.reject =function(){
    console.debug("WebRTCommCall:reject()");
    if(this.webRTCommClient.isOpened())
    {
        try
        {
            this.connector.reject();
        }
        catch(exception)
        {
            console.error("WebRTCommCall:reject(): catched exception:"+exception);
            // Close properly the communication
            try {
                this.close();
            } catch(e) {}    
            throw exception;  
        }
    }
    else
    {   
        console.error("WebRTCommCall:reject(): bad state, unauthorized action");
        throw "WebRTCommCall:reject(): bad state, unauthorized action";    
    }
}

/**
 * Send Short message to WebRTC communication peer
 * @public 
 * @param {String} message message to send
 * @throw {String} Exception "bad state, unauthorized action"
 * @throw {String} Exception "internal error,check console logs"
 */ 
WebRTCommCall.prototype.sendMessage =function(message){
    console.debug("WebRTCommCall:sendMessage()");
    if(this.webRTCommClient.isOpened())
    {
        if(this.isOpened())
        {
            if(this.messageChannel && this.messageChannel.readyState=="open")
            {
                try
                {
                    this.messageChannel.send(message); 
                }
                catch(exception)
                {
                    console.error("WebRTCommCall:sendMessage(): catched exception:"+exception);
                    throw "WebRTCommCall:sendMessage(): catched exception:"+exception; 
                }
            }
            else
            {
                console.error("WebRTCommCall:sendMessage(): bad state, unauthorized action");
                throw "WebRTCommCall:sendMessage(): bad state, unauthorized action, messageChannel not opened";        
            }
        }
        else
        {
            console.error("WebRTCommCall:sendMessage(): bad state, unauthorized action");
            throw "WebRTCommCall:sendMessage(): bad state, unauthorized action";        
        }
    }
    else
    {   
        console.error("WebRTCommCall:sendMessage(): bad state, unauthorized action");
        throw "WebRTCommCall:sendMessage(): bad state, unauthorized action";    
    }
}

/**
 * Mute local audio media stream
 * @public 
 * @throw {String} Exception "bad state, unauthorized action"
 * @throw {String} Exception "not implemented by navigator"
 */ 
WebRTCommCall.prototype.muteLocalAudioMediaStream =function(){
    console.debug("WebRTCommCall:muteLocalAudioMediaStream()");
    if(this.configuration.localMediaStream && this.configuration.localMediaStream.signalingState==this.configuration.localMediaStream.LIVE)
    {
        var audioTracks = undefined;
        if(this.configuration.localMediaStream.audioTracks) audioTracks=this.configuration.localMediaStream.audioTracks;
        else if(this.configuration.localMediaStream.getAudioTracks) audioTracks=this.configuration.localMediaStream.getAudioTracks();
        if(audioTracks)
        {
            for(var i=0; i<audioTracks.length;i++)
            {
                audioTracks[i].enabled=false;
            }                  
        } 
        else
        {
            console.error("WebRTCommCall:muteLocalAudioMediaStream(): not implemented by navigator");
            throw "WebRTCommCall:muteLocalAudioMediaStream(): not implemented by navigator";  
        }
    }
    else
    {   
        console.error("WebRTCommCall:muteLocalAudioMediaStream(): bad state, unauthorized action");
        throw "WebRTCommCall:muteLocalAudioMediaStream(): bad state, unauthorized action";    
    }
}

/**
 * Unmute local audio media stream
 * @public 
 */ 
WebRTCommCall.prototype.unmuteLocalAudioMediaStream =function(){
    console.debug("WebRTCommCall:unmuteLocalAudioMediaStream()");
    if(this.configuration.localMediaStream && this.configuration.localMediaStream.signalingState==this.configuration.localMediaStream.LIVE)
    {
        var audioTracks = undefined;
        if(this.configuration.localMediaStream.audioTracks) audioTracks=this.configuration.localMediaStream.audioTracks;
        else if(this.configuration.localMediaStream.getAudioTracks) audioTracks=this.configuration.localMediaStream.getAudioTracks();
        if(audioTracks)
        {
            for(var i=0; i<audioTracks.length;i++)
            {
                audioTracks[i].enabled=true;
            }                  
        }   
        else
        {
            console.error("WebRTCommCall:unmuteLocalAudioMediaStream(): not implemented by navigator");
            throw "WebRTCommCall:unmuteLocalAudioMediaStream(): not implemented by navigator";  
        }
    } 
    else
    {   
        console.error("WebRTCommCall:unmuteLocalAudioMediaStream(): bad state, unauthorized action");
        throw "WebRTCommCall:unmuteLocalAudioMediaStream(): bad state, unauthorized action";    
    }
}

/**
 * Mute remote audio media stream
 * @public 
 * @throw {String} Exception "bad state, unauthorized action"
 * @throw {String} Exception "not implemented by navigator"
 */ 
WebRTCommCall.prototype.muteRemoteAudioMediaStream =function(){
    console.debug("WebRTCommCall:muteRemoteAudioMediaStream()");
    if(this.remoteMediaStream && this.remoteMediaStream.signalingState==this.remoteMediaStream.LIVE)
    {
        var audioTracks = undefined;
        if(this.remoteMediaStream.audioTracks) audioTracks=this.remoteMediaStream.audioTracks;
        else if(this.remoteMediaStream.getAudioTracks) audioTracks=this.remoteMediaStream.getAudioTracks();
        if(audioTracks)
        {
            for(var i=0; i<audioTracks.length;i++)
            {
                audioTracks[i].enabled=false;
            }                  
        } 
        else
        {
            console.error("WebRTCommCall:muteRemoteAudioMediaStream(): not implemented by navigator");
            throw "WebRTCommCall:muteRemoteAudioMediaStream(): not implemented by navigator";  
        }
    }
    else
    {   
        console.error("WebRTCommCall:muteRemoteAudioMediaStream(): bad state, unauthorized action");
        throw "WebRTCommCall:muteRemoteAudioMediaStream(): bad state, unauthorized action";    
    }
}

/**
 * Unmute remote audio media stream
 * @public 
 * @throw {String} Exception "bad state, unauthorized action"
 * @throw {String} Exception "not implemented by navigator"
 */ 
WebRTCommCall.prototype.unmuteRemoteAudioMediaStream =function(){
    console.debug("WebRTCommCall:unmuteRemoteAudioMediaStream()");
    if(this.remoteMediaStream && this.remoteMediaStream.signalingState==this.remoteMediaStream.LIVE)
    {
        var audioTracks = undefined;
        if(this.remoteMediaStream.audioTracks) audioTracks=this.remoteMediaStream.audioTracks;
        else if(this.remoteMediaStream.getAudioTracks) audioTracks=this.remoteMediaStream.getAudioTracks();
        if(audioTracks)
        {
            for(var i=0; i<audioTracks.length;i++)
            {
                audioTracks[i].enabled=true;
            }                  
        }   
        else
        {
            console.error("WebRTCommCall:unmuteRemoteAudioMediaStream(): not implemented by navigator");
            throw "WebRTCommCall:unmuteRemoteAudioMediaStream(): not implemented by navigator";  
        }
    } 
    else
    {   
        console.error("WebRTCommCall:unmuteRemoteAudioMediaStream(): bad state, unauthorized action");
        throw "WebRTCommCall:unmuteRemoteAudioMediaStream(): bad state, unauthorized action";    
    }
}

/**
 * Hide local video media stream
 * @public 
 * @throw {String} Exception "bad state, unauthorized action"
 * @throw {String} Exception "not implemented by navigator"
 */ 
WebRTCommCall.prototype.hideLocalVideoMediaStream =function(){
    console.debug("WebRTCommCall:hideLocalVideoMediaStream()");
    if(this.configuration.localMediaStream && this.configuration.localMediaStream.signalingState==this.configuration.localMediaStream.LIVE)
    {
        var videoTracks = undefined;
        if(this.configuration.localMediaStream.videoTracks) videoTracks=this.configuration.localMediaStream.videoTracks;
        else if(this.configuration.localMediaStream.getVideoTracks) videoTracks=this.configuration.localMediaStream.getVideoTracks();
        if(videoTracks)
        {
            videoTracks.enabled= !videoTracks.enabled;
            for(var i=0; i<videoTracks.length;i++)
            {
                videoTracks[i].enabled=false;
            }                  
        }  
        else
        {
            console.error("WebRTCommCall:hideLocalVideoMediaStream(): not implemented by navigator");
            throw "WebRTCommCall:hideLocalVideoMediaStream(): not implemented by navigator";  
        }
    } 
    else
    {   
        console.error("WebRTCommCall:hideLocalVideoMediaStream(): bad state, unauthorized action");
        throw "WebRTCommCall:hideLocalVideoMediaStream(): bad state, unauthorized action";    
    }
}

/**
 * Show local video media stream
 * @public 
 * @throw {String} Exception "bad state, unauthorized action"
 * @throw {String} Exception "not implemented by navigator"
 */ 
WebRTCommCall.prototype.showLocalVideoMediaStream =function(){
    console.debug("WebRTCommCall:showLocalVideoMediaStream()");
    if(this.configuration.localMediaStream && this.configuration.localMediaStream.signalingState==this.configuration.localMediaStream.LIVE)
    {
        var videoTracks = undefined;
        if(this.configuration.localMediaStream.videoTracks) videoTracks=this.configuration.localMediaStream.videoTracks;
        else if(this.configuration.localMediaStream.getVideoTracks) videoTracks=this.configuration.localMediaStream.getVideoTracks();
        if(videoTracks)
        {
            videoTracks.enabled= !videoTracks.enabled;
            for(var i=0; i<videoTracks.length;i++)
            {
                videoTracks[i].enabled=true;
            }                  
        }  
        else
        {
            console.error("WebRTCommCall:showLocalVideoMediaStream(): not implemented by navigator");
            throw "WebRTCommCall:showLocalVideoMediaStream(): not implemented by navigator";  
        }
    }
    else
    {   
        console.error("WebRTCommCall:showLocalVideoMediaStream(): bad state, unauthorized action");
        throw "WebRTCommCall:showLocalVideoMediaStream(): bad state, unauthorized action";    
    }
}


/**
 * Hide remote video media stream
 * @public 
 * @throw {String} Exception "bad state, unauthorized action"
 * @throw {String} Exception "not implemented by navigator"
 */ 
WebRTCommCall.prototype.hideRemoteVideoMediaStream =function(){
    console.debug("WebRTCommCall:hideRemoteVideoMediaStream()");
    if(this.remoteMediaStream && this.remoteMediaStream.signalingState==this.remoteMediaStream.LIVE)
    {
        var videoTracks = undefined;
        if(this.remoteMediaStream.videoTracks) videoTracks=this.remoteMediaStream.videoTracks;
        else if(this.remoteMediaStream.getVideoTracks) videoTracks=this.remoteMediaStream.getVideoTracks();      
        if(videoTracks)
        {
            videoTracks.enabled= !videoTracks.enabled;
            for(var i=0; i<videoTracks.length;i++)
            {
                videoTracks[i].enabled=false;
            }                  
        }  
        else
        {
            console.error("WebRTCommCall:hideRemoteVideoMediaStream(): not implemented by navigator");
            throw "WebRTCommCall:hideRemoteVideoMediaStream(): not implemented by navigator";  
        }
    } 
    else
    {   
        console.error("WebRTCommCall:hideRemoteVideoMediaStream(): bad state, unauthorized action");
        throw "WebRTCommCall:hideRemoteVideoMediaStream(): bad state, unauthorized action";    
    }
}

/**
 * Show remote video media stream
 * @public 
 * @throw {String} Exception "bad state, unauthorized action"
 * @throw {String} Exception "not implemented by navigator"
 */ 
WebRTCommCall.prototype.showRemoteVideoMediaStream =function(){
    console.debug("WebRTCommCall:showRemoteVideoMediaStream()");
    if(this.remoteMediaStream && this.remoteMediaStream.signalingState==this.remoteMediaStream.LIVE)
    {
        var videoTracks = undefined;
        if(this.remoteMediaStream.videoTracks) videoTracks=this.remoteMediaStream.videoTracks;
        else if(this.remoteMediaStream.getVideoTracks) videoTracks=this.remoteMediaStream.getVideoTracks();
        if(videoTracks)
        {
            videoTracks.enabled= !videoTracks.enabled;
            for(var i=0; i<videoTracks.length;i++)
            {
                videoTracks[i].enabled=true;
            }                  
        }  
        else
        {
            console.error("WebRTCommCall:showRemoteVideoMediaStream(): not implemented by navigator");
            throw "WebRTCommCall:showRemoteVideoMediaStream(): not implemented by navigator";  
        }
    }
    else
    {   
        console.error("WebRTCommCall:showRemoteVideoMediaStream(): bad state, unauthorized action");
        throw "WebRTCommCall:showRemoteVideoMediaStream(): bad state, unauthorized action";    
    }
}


/**
 * Check configuration 
 * @private
 * @return true configuration ok false otherwise
 */ 
WebRTCommCall.prototype.checkConfiguration=function(configuration){
    console.debug("WebRTCommCall:checkConfiguration()");
            
    var check=true;
    // displayName, audioCodecsFilter, videoCodecsFilter NOT mandatoty in configuration
            
    if(configuration.localMediaStream==undefined)
    {
        check=false;
        console.error("WebRTCommCall:checkConfiguration(): missing localMediaStream");       
    }
                
    if(configuration.audioMediaFlag==undefined || (typeof(configuration.audioMediaFlag) != 'boolean'))
    {
        check=false;
        console.error("WebRTCommCall:checkConfiguration(): missing audio media flag");       
    }
       
    if(configuration.videoMediaFlag==undefined || (typeof(configuration.videoMediaFlag) != 'boolean'))
    {
        check=false;
        console.error("WebRTCommCall:checkConfiguration(): missing video media flag");       
    }
    
    if(configuration.messageMediaFlag==undefined || (typeof(configuration.messageMediaFlag) != 'boolean'))
    {
        check=false;
        console.error("WebRTCommCall:checkConfiguration(): missing message media flag");       
    }
    return check;
}

/**
 * Create RTCPeerConnection 
 * @private
 * @return true configuration ok false otherwise
 */ 
WebRTCommCall.prototype.createRTCPeerConnection =function(){
    console.debug("WebRTCommCall:createPeerConnection()");
    var rtcPeerConnectionConfiguration = {
        iceServers: []
    };

    this.peerConnectionState='new';
    var that = this;
    if(this.webRTCommClient.configuration.RTCPeerConnection.stunServer)
    {
        rtcPeerConnectionConfiguration = {
            iceServers: [{
                url:"stun:"+this.webRTCommClient.configuration.RTCPeerConnection.stunServer
            }]
        };
    }
         
    var mediaContraints = {
        optional: [{
            RtpDataChannels: true
        }]
    };
    if(window.webkitRTCPeerConnection)
    {
        this.peerConnection = new window.webkitRTCPeerConnection(rtcPeerConnectionConfiguration, mediaContraints);
    }
    else if(window.mozRTCPeerConnection)
    {
        this.peerConnection = new window.mozRTCPeerConnection(rtcPeerConnectionConfiguration, mediaContraints);
    }
      
    this.peerConnection.onaddstream = function(event) {
        that.onRtcPeerConnectionOnAddStreamEvent(event);
    }  
	
    this.peerConnection.onremovestream = function(event) {
        that.onRtcPeerConnectionOnRemoveStreamEvent(event);
    }   
    
    this.peerConnection.onstatechange= function(event) {
        that.onRtcPeerConnectionStateChangeEvent(event);
    }
          
    this.peerConnection.onicecandidate= function(rtcIceCandidateEvent) {
        that.onRtcPeerConnectionIceCandidateEvent(rtcIceCandidateEvent);
    }
     
    this.peerConnection.ongatheringchange= function(event) {
        that.onRtcPeerConnectionGatheringChangeEvent(event);
    }

    this.peerConnection.onicechange= function(event) {
        that.onRtcPeerConnectionIceChangeEvent(event);
    } 
    
    this.peerConnection.onopen= function(event) {
        that.onRtcPeerConnectionOnOpenEvent(event);
    }
     
    this.peerConnection.onidentityresult= function(event) {
        that.onRtcPeerConnectionIdentityResultEvent(event);
    }
    
    this.peerConnection.onnegotiationneeded= function(event) {
        that.onRtcPeerConnectionIceNegotiationNeededEvent(event);
    }
    
    this.peerConnection.ondatachannel= function(event) {
        that.onRtcPeerConnectionOnMessageChannelEvent(event);
    }
    
    console.debug("WebRTCommCall:createPeerConnection(): this.peerConnection="+JSON.stringify( this.peerConnection)); 
}
   
/**
 * Implementation of the PrivateCallConnector listener interface: process remote SDP offer event
 * @private 
 * @param {string} remoteSdpOffer Remote peer SDP offer
 */ 
WebRTCommCall.prototype.onPrivateCallConnectorRemoteSdpOfferEvent=function(remoteSdpOffer){
    console.debug("WebRTCommCall:onPrivateCallConnectorSdpOfferEvent()");   
    this.remoteSdpOffer = remoteSdpOffer;
}  

/**
 * Implementation of the PrivateCallConnector listener interface: process remote SDP answer event
 * @private 
 * @param {string} remoteSdpAnswer
 * @throw exception internal error
 */ 
WebRTCommCall.prototype.onPrivateCallConnectorRemoteSdpAnswerEvent=function(remoteSdpAnswer){
    console.debug("WebRTCommCall:onPrivateCallConnectorRemoteSdpAnswerEvent()");
    try
    {
        var sdpAnswer=undefined;
        if(window.webkitRTCPeerConnection)
        {
            sdpAnswer = new RTCSessionDescription({
                type: 'answer',
                sdp: remoteSdpAnswer
            });
        }
        else if(window.mozRTCPeerConnection)
        {
            sdpAnswer = new mozRTCSessionDescription({
                type: 'answer',
                sdp: remoteSdpAnswer
            });
        }
           
        var that=this;
        this.peerConnectionState = 'answer-received';
        this.peerConnection.setRemoteDescription(sdpAnswer, function() {
            that.onRtcPeerConnectionSetRemoteDescriptionSuccessEvent();
        }, function(error) {
            that.onRtcPeerConnectionSetRemoteDescriptionErrorEvent(error);
        }); 
    }
    catch(exception)
    {
        console.error("WebRTCommCall:onPrivateCallConnectorRemoteSdpAnswerEvent(): catched exception:"+exception); 
        throw exception;  
    } 
} 

/**
 * Implementation of the PrivateCallConnector listener interface: process call opened event
 * @private 
 */ 
WebRTCommCall.prototype.onPrivateCallConnectorCallOpenedEvent=function()
{
    console.debug("WebRTCommCall:onPrivateCallConnectorCallOpenedEvent()"); 
    // Notify event to the listener
    if(this.webRTCommClient.eventListener.onWebRTCommCallOpenEvent)
    {
        var that=this;
        setTimeout(function(){
            try {
                that.webRTCommClient.eventListener.onWebRTCommCallOpenEvent(that);
            }
            catch(exception)
            {
                console.error("WebRTCommCall:onPrivateCallConnectorCallOpenedEvent(): catched exception in listener:"+exception);    
            }
        },1);
    }
}

/**
 * Implementation of the PrivateCallConnector listener interface: process call in progress event
 * @private 
 */ 
WebRTCommCall.prototype.onPrivateCallConnectorCallInProgressEvent=function()
{
    console.debug("WebRTCommCall:onPrivateCallConnectorCallOpenedEvent()"); 
    // Notify event to the listener
    if(this.webRTCommClient.eventListener.onWebRTCommCallInProgressEvent)
    {
        var that=this;
        setTimeout(function(){
            try {
                that.webRTCommClient.eventListener.onWebRTCommCallInProgressEvent(that);
            }
            catch(exception)
            {
                console.error("WebRTCommCall:onPrivateCallConnectorCallOpenedEvent(): catched exception in listener:"+exception);    
            }
        },1);
    }
}

/**
 * Implementation of the PrivateCallConnector listener interface: process call error event
 * @private 
 * @param {string} error call control error
 */ 
WebRTCommCall.prototype.onPrivateCallConnectorCallOpenErrorEvent=function(error)
{
    console.debug("WebRTCommCall:onPrivateCallConnectorCallOpenErrorEvent():error="+error);
    // Notify event to the listener
    if(this.webRTCommClient.eventListener.onWebRTCommCallOpenErrorEvent)
    {
        var that=this;
        setTimeout(function(){
            try {
                that.webRTCommClient.eventListener.onWebRTCommCallOpenErrorEvent(that,error);
            }
            catch(exception)
            {
                console.error("WebRTCommCall:onPrivateCallConnectorCallOpenErrorEvent(): catched exception in listener:"+exception);    
            }
        },1);
    }
}

/**
 * Implementation of the PrivateCallConnector listener interface: process call ringing event
 * @private 
 * @param {string} callerPhoneNumber  caller contact identifier (e.g. bob@sip.net)
 * @param {string} callerDisplayName  caller contact identifier (e.g. bob@sip.net)
 */ 
WebRTCommCall.prototype.onPrivateCallConnectorCallRingingEvent=function(callerPhoneNumber,callerDisplayName)
{
    console.debug("WebRTCommCall:onPrivateCallConnectorCallRingingEvent():callerPhoneNumber="+callerPhoneNumber);
    console.debug("WebRTCommCall:onPrivateCallConnectorCallRingingEvent():callerDisplayName="+callerDisplayName);
    // Notify the closed event to the listener
    this.callerPhoneNumber=callerPhoneNumber;
    this.callerDisplayName=callerDisplayName;
    if(this.webRTCommClient.eventListener.onWebRTCommCallRingingEvent)
    {
        var that=this;
        setTimeout(function(){
            try {
                that.webRTCommClient.eventListener.onWebRTCommCallRingingEvent(that);
            }
            catch(exception)
            {
                console.error("WebRTCommCall:onPrivateCallConnectorCallOpenErrorEvent(): catched exception in listener:"+exception);    
            }
        },1);
    }
}

/**
 * Implementation of the PrivateCallConnector listener interface: process call ringing back event
 * @private 
 */ 
WebRTCommCall.prototype.onPrivateCallConnectorCallRingingBackEvent=function()
{
    console.debug("WebRTCommCall:onPrivateCallConnectorCallRingingBackEvent()");
    // Notify the closed event to the listener
    if(this.webRTCommClient.eventListener.onWebRTCommCallRingingBackEvent)
    {
        var that=this;
        setTimeout(function(){
            try {
                that.webRTCommClient.eventListener.onWebRTCommCallRingingBackEvent(that);
            }
            catch(exception)
            {
                console.error("WebRTCommCall:onPrivateCallConnectorCallOpenErrorEvent(): catched exception in listener:"+exception);    
            }
        },1);
    }
}


/**
 * Implementation of the PrivateCallConnector listener interface: process call closed event 
 * @private 
 */ 
WebRTCommCall.prototype.onPrivateCallConnectorCallClosedEvent=function()
{
    console.debug("WebRTCommCall:onPrivateCallConnectorCallClosedEvent()");
    this.connector=undefined;
    // Force communication close 
    try {
        this.close();
    } catch(exception) {}   
}
 

/**
 * Implementation of the PrivateCallConnector listener interface: process call hangup event  
 * @private 
 */ 
WebRTCommCall.prototype.onPrivateCallConnectorCallHangupEvent=function()
{
    console.debug("WebRTCommCall:onPrivateCallConnectorCallHangupEvent()");
    // Notify the closed event to the listener
    if(this.webRTCommClient.eventListener.onWebRTCommCallHangupEvent)
    {
        var that=this;
        setTimeout(function(){
            try {
                that.webRTCommClient.eventListener.onWebRTCommCallHangupEvent(that);
            }
            catch(exception)
            {
                console.error("WebRTCommCall:onPrivateCallConnectorCallHangupEvent(): catched exception in listener:"+exception);    
            }
        },1);
    }  
}

/**
 * Implementation of the RTCPeerConnection listener interface: process RTCPeerConnection error event
 * @private 
 * @param {string} error internal error
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionErrorEvent=function(error){  
    console.debug("WebRTCommCall:onRtcPeerConnectionErrorEvent(): error="+error);
    // Critical issue, notify the error and close properly the call
    // Notify the error event to the listener
    if(this.webRTCommClient.eventListener.onWebRTCommCallOpenErrorEvent)
    {
        var that=this;
        setTimeout(function(){
            try {
                that.webRTCommClient.eventListener.onWebRTCommCallOpenErrorEvent(that,error);
            }
            catch(exception)
            {
                console.error("WebRTCommCall:onRtcPeerConnectionErrorEvent(): catched exception in listener:"+exception);    
            }
        },1); 
    }
    
    try {
        this.close();
    } catch(exception) {}
}


/**
 * Implementation of the RTCPeerConnection listener interface: handle RTCPeerConnection state machine
 * @private
 * @param {MediaStreamEvent} event  RTCPeerConnection Event
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionOnAddStreamEvent=function(event){
    try
    {
        console.debug("WebRTCommCall:onRtcPeerConnectionOnAddStreamEvent(): event="+event); 
        if(this.peerConnection)
        {           
            console.debug("WebRTCommCall:onRtcPeerConnectionOnAddStreamEvent(): this.peerConnection.signalingState="+ this.peerConnection.signalingState); 
            console.debug("WebRTCommCall:onRtcPeerConnectionOnAddStreamEvent(): this.peerConnection.iceGatheringState="+ this.peerConnection.iceGatheringState);
            console.debug("WebRTCommCall:onRtcPeerConnectionOnAddStreamEvent(): this.peerConnection.iceConnectionState="+ this.peerConnection.iceConnectionState); 
            console.debug("WebRTCommCall:onRtcPeerConnectionOnAddStreamEvent(): this.peerConnectionState="+this.peerConnectionState);
            this.remoteMediaStream = event.stream;
        }
        else
        {
            console.warn("WebRTCommCall:onRtcPeerConnectionOnAddStreamEvent(): event ignored");        
        }
    }
    catch(exception)
    {
        console.error("WebRTCommCall:onRtcPeerConnectionOnAddStreamEvent(): catched exception, exception:"+exception);
        this.onRtcPeerConnectionErrorEvent();
    }
}

/**
 * Implementation of the RTCPeerConnection listener interface: handle RTCPeerConnection state machine
 * @private
 * @param {MediaStreamEvent} event  RTCPeerConnection Event
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionOnRemoveStreamEvent=function(event){
    try
    {
        console.debug("WebRTCommCall:onRtcPeerConnectionOnRemoveStreamEvent(): event="+event); 
        if(this.peerConnection)
        {           
            console.debug("WebRTCommCall:onRtcPeerConnectionOnRemoveStreamEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState); 
            console.debug("WebRTCommCall:onRtcPeerConnectionOnRemoveStreamEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
            console.debug("WebRTCommCall:onRtcPeerConnectionOnRemoveStreamEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
            console.debug("WebRTCommCall:onRtcPeerConnectionOnRemoveStreamEvent(): this.peerConnectionState="+this.peerConnectionState);
            this.remoteMediaStream = undefined;
        }
        else
        {
            console.warn("WebRTCommCall:onRtcPeerConnectionOnRemoveStreamEvent(): event ignored");        
        }
    }
    catch(exception)
    {
        console.error("WebRTCommCall:onRtcPeerConnectionOnRemoveStreamEvent(): catched exception, exception:"+exception);
        this.onRtcPeerConnectionErrorEvent();
    }
}

/**
 * Implementation of the RTCPeerConnection listener interface: handle RTCPeerConnection state machine
 * @private
 * @param {RTCPeerConnectionIceEvent} rtcIceCandidateEvent  RTCPeerConnection Event
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionIceCandidateEvent=function(rtcIceCandidateEvent){
    try
    {         
        console.debug("WebRTCommCall:onRtcPeerConnectionIceCandidateEvent(): rtcIceCandidateEvent="+JSON.stringify(rtcIceCandidateEvent.candidate));
        if(this.peerConnection)
        {           
            console.debug("WebRTCommCall:onRtcPeerConnectionIceCandidateEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
            console.debug("WebRTCommCall:onRtcPeerConnectionIceCandidateEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
            console.debug("WebRTCommCall:onRtcPeerConnectionIceCandidateEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
            console.debug("WebRTCommCall:onRtcPeerConnectionIceCandidateEvent(): this.peerConnectionState="+this.peerConnectionState);
            if(this.peerConnection.signalingState != 'closed')
            {
                if(this.peerConnection.iceGatheringState=="complete")
                {
                    if(window.webkitRTCPeerConnection)
                    {
                        if(this.peerConnectionState == 'preparing-offer') 
                        {
                            this.connector.invite(this.peerConnection.localDescription.sdp)
                            this.peerConnectionState = 'offer-sent';
                        } 
                        else if (this.peerConnectionState == 'preparing-answer') 
                        {
                            this.connector.accept(this.peerConnection.localDescription.sdp)
                            this.peerConnectionState = 'established';
                            // Notify opened event to listener
                            if(this.webRTCommClient.eventListener.onWebRTCommCallOpenedEvent) 
                            {
                                var that=this;
                                setTimeout(function(){
                                    try {
                                        that.webRTCommClient.eventListener.onWebRTCommCallOpenedEvent(that);
                                    }
                                    catch(exception)
                                    {
                                        console.error("WebRTCommCall:onRtcPeerConnectionIceCandidateEvent(): catched exception in listener:"+exception);    
                                    }
                                },1); 
                            }
                        }
                        else if (this.peerConnectionState == 'established') 
                        {
                        // Why this last ice candidate event?
                        } 
                        else
                        {
                            console.error("WebRTCommCall:onRtcPeerConnectionIceCandidateEvent(): RTCPeerConnection bad state!");
                        }
                    }
                }
            }
            else
            {
                console.error("WebRTCommCall:onRtcPeerConnectionIceCandidateEvent(): RTCPeerConnection closed!");
            }
        }
        else
        {
            console.warn("WebRTCommCall:onRtcPeerConnectionIceCandidateEvent(): event ignored");        
        }
    }
    catch(exception)
    {
        console.error("WebRTCommCall:onRtcPeerConnectionIceCandidateEvent(): catched exception, exception:"+exception);
        this.onRtcPeerConnectionErrorEvent(exception);
    }
}

/**
 * Implementation of the RTCPeerConnection listener interface: handle RTCPeerConnection state machine
 * @private
 * @param {RTCSessionDescription} sdpOffer  RTCPeerConnection SDP offer event
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionCreateOfferSuccessEvent=function(sdpOffer){ 
    try
    {
        console.debug("WebRTCommCall:onRtcPeerConnectionCreateOfferSuccessEvent(): sdpOffer="+JSON.stringify(sdpOffer)); 
        if(this.peerConnection)
        {
            console.debug("WebRTCommCall:onRtcPeerConnectionCreateOfferSuccessEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
            console.debug("WebRTCommCall:onRtcPeerConnectionCreateOfferSuccessEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
            console.debug("WebRTCommCall:onRtcPeerConnectionCreateOfferSuccessEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
            console.debug("WebRTCommCall:onRtcPeerConnectionCreateOfferSuccessEvent(): this.peerConnectionState="+this.peerConnectionState);

            if (this.peerConnectionState == 'new') 
            {
                // Preparing offer.
                var that=this;
                this.peerConnectionState = 'preparing-offer';
                var sdpOfferString=sdpOffer.sdp;
                var sdpParser = new SDPParser();
                var parsedSdpOffer = sdpParser.parse(sdpOfferString);
                
                // Check if offer is inline with the requested media constraints
                if(this.configuration.videoMediaFlag==false)
                {
                    this.removeMediaDescription(parsedSdpOffer,"video"); 
                    sdpOffer.sdp=parsedSdpOffer;
                }
                if(this.configuration.audioMediaFlag==false)
                {
                    this.removeMediaDescription(parsedSdpOffer,"audio"); 
                    sdpOffer.sdp=parsedSdpOffer;
                }
                if(this.configuration.audioCodecsFilter || this.configuration.videoCodecsFilter)
                {
                    try
                    {
                        // Apply audio/video codecs filter to RTCPeerConnection SDP offer to
                        this.applyConfiguredCodecFilterOnSessionDescription(parsedSdpOffer, this.configuration.audioCodecsFilter);
                        console.debug("WebRTCommCall:onRtcPeerConnectionCreateOfferSuccessEvent(): parsedSdpOffer="+parsedSdpOffer);
                        sdpOffer.sdp=parsedSdpOffer;
                    }
                    catch(exception)
                    {
                        console.error("WebRTCommCall:onRtcPeerConnectionCreateOfferSuccessEvent(): configured codec filtering has failded, use inital RTCPeerConnection SDP offer");
                    }
                }
            
                this.peerConnectionLocalDescription=sdpOffer;
                this.peerConnection.setLocalDescription(sdpOffer, function() {
                    that.onRtcPeerConnectionSetLocalDescriptionSuccessEvent();
                }, function(error) {
                    that.onRtcPeerConnectionSetLocalDescriptionErrorEvent(error);
                });
            } 
            else
            {
                console.error("WebRTCommCall:onRtcPeerConnectionCreateOfferSuccessEvent(): RTCPeerConnection bad state!");
            }
        }
        else
        {
            console.warn("WebRTCommCall:onRtcPeerConnectionCreateOfferSuccessEvent(): event ignored");        
        }
    }
    catch(exception)
    {
        console.error("WebRTCommCall:onRtcPeerConnectionCreateOfferSuccessEvent(): catched exception, exception:"+exception);
        this.onRtcPeerConnectionErrorEvent(); 
    }
}

/**
 * Implementation of the RTCPeerConnection listener interface: handle RTCPeerConnection state machine
 * @private
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionCreateOfferErrorEvent=function(error){
    try
    {
        console.error("WebRTCommCall:onRtcPeerConnectionCreateOfferErrorEvent():error="+JSON.stringify(error)); 
        if(this.peerConnection)
        {
            console.debug("WebRTCommCall:onRtcPeerConnectionCreateOfferErrorEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
            console.debug("WebRTCommCall:onRtcPeerConnectionCreateOfferErrorEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
            console.debug("WebRTCommCall:onRtcPeerConnectionCreateOfferErrorEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
            console.debug("WebRTCommCall:onRtcPeerConnectionCreateOfferErrorEvent(): this.peerConnectionState="+this.peerConnectionState);
            throw "WebRTCommCall:onRtcPeerConnectionCreateOfferErrorEvent():error="+error; 
        }
        else
        {
            console.warn("WebRTCommCall:onRtcPeerConnectionCreateOfferErrorEvent(): event ignored");        
        }
    }
    catch(exception)
    {
        console.error("WebRTCommCall:onRtcPeerConnectionCreateOfferErrorEvent(): catched exception, exception:"+exception);
        this.onRtcPeerConnectionErrorEvent();  
    }
}

/**
 * Implementation of the RTCPeerConnection listener interface: handle RTCPeerConnection state machine
 * @private
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionSetLocalDescriptionSuccessEvent=function(){
    try
    {
        console.debug("WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionSuccessEvent()"); 
        if(this.peerConnection)
        {
            console.debug("WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionSuccessEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
            console.debug("WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionSuccessEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
            console.debug("WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionSuccessEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
            console.debug("WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionSuccessEvent(): this.peerConnectionState="+this.peerConnectionState);

            if(window.mozRTCPeerConnection)
            {
                if(this.peerConnectionState == 'preparing-offer') 
                {
                    this.connector.invite(this.peerConnection.localDescription.sdp)
                    this.peerConnectionState = 'offer-sent';
                } 
                else if (this.peerConnectionState == 'preparing-answer') 
                {
                    this.connector.accept(this.peerConnection.localDescription.sdp)
                    this.peerConnectionState = 'established';
                    // Notify opened event to listener
                    if(this.webRTCommClient.eventListener.onWebRTCommCallOpenedEvent) 
                    {
                        var that=this;
                        setTimeout(function(){
                            try {
                                that.webRTCommClient.eventListener.onWebRTCommCallOpenedEvent(that);
                            }
                            catch(exception)
                            {
                                console.error("WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionSuccessEvent(): catched exception in listener:"+exception);    
                            }
                        },1); 
                    }
                }
                else if (this.peerConnectionState == 'established') 
                {
                // Why this last ice candidate event?
                } 
                else
                {
                    console.error("WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionSuccessEvent(): RTCPeerConnection bad state!");
                }      
            }
        }
        else
        {
            console.warn("WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionSuccessEvent(): event ignored");        
        }
    }
    catch(exception)
    {
        console.error("WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionSuccessEvent(): catched exception, exception:"+exception);
        this.onRtcPeerConnectionErrorEvent();     
    }
}

/**
 * Implementation of the RTCPeerConnection listener interface: handle RTCPeerConnection state machine
 * @private
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionSetLocalDescriptionErrorEvent=function(error){
    try
    {
        console.error("WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionErrorEvent():error="+JSON.stringify(error)); 
        if(this.peerConnection)
        {
            console.debug("WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionErrorEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
            console.debug("WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionErrorEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
            console.debug("WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionErrorEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
            console.debug("WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionErrorEvent(): this.peerConnectionState="+this.peerConnectionState);
            throw "WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionErrorEvent():error="+error;
        }
        else
        {
            console.warn("WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionErrorEvent(): event ignored");        
        }
    }
    catch(exception)
    {
        console.error("WebRTCommCall:onRtcPeerConnectionSetLocalDescriptionErrorEvent(): catched exception, exception:"+exception);
        this.onRtcPeerConnectionErrorEvent();     
    }
}

/**
 * Implementation of the RTCPeerConnection listener interface: handle RTCPeerConnection state machine
 * @private
 * @param {RTCSessionDescription} answer  RTCPeerConnection SDP answer event
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionCreateAnswerSuccessEvent=function(answer){
    try
    {
        console.debug("WebRTCommCall:onRtcPeerConnectionCreateAnswerSuccessEvent():answer="+JSON.stringify(answer)); 
        if(this.peerConnection)
        {
            console.debug("WebRTCommCall:onRtcPeerConnectionCreateAnswerSuccessEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
            console.debug("WebRTCommCall:onRtcPeerConnectionCreateAnswerSuccessEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
            console.debug("WebRTCommCall:onRtcPeerConnectionCreateAnswerSuccessEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
            console.debug("WebRTCommCall:onRtcPeerConnectionCreateAnswerSuccessEvent(): this.peerConnectionState="+this.peerConnectionState);
           
            if(this.peerConnectionState == 'offer-received') 
            {
                // Prepare answer.
                var that=this;
                this.peerConnectionState = 'preparing-answer';
                this.peerConnectionLocalDescription=answer;
                this.peerConnection.setLocalDescription(answer, function() {
                    that.onRtcPeerConnectionSetLocalDescriptionSuccessEvent();
                }, function(error) {
                    that.onRtcPeerConnectionSetLocalDescriptionErrorEvent(error);
                });
            } 
            else
            {
                console.error("WebRTCommCall:onRtcPeerConnectionCreateAnswerSuccessEvent(): RTCPeerConnection bad state!");
            }
        }
        else
        {
            console.warn("WebRTCommCall:onRtcPeerConnectionCreateAnswerSuccessEvent(): event ignored");        
        }
    }
    catch(exception)
    {
        console.error("WebRTCommCall:onRtcPeerConnectionCreateAnswerSuccessEvent(): catched exception, exception:"+exception);
        this.onRtcPeerConnectionErrorEvent();     
    }  
}

/**
 * Implementation of the RTCPeerConnection listener interface: handle RTCPeerConnection state machine
 * @private
 * @param {String} error  SDP error
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionCreateAnswerErrorEvent=function(error){
    console.error("WebRTCommCall:onRtcPeerConnectionCreateAnswerErrorEvent():error="+JSON.stringify(error));
    try
    {
        if(this.peerConnection)
        {
            console.debug("WebRTCommCall:onRtcPeerConnectionCreateAnswerErrorEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
            console.debug("WebRTCommCall:onRtcPeerConnectionCreateAnswerErrorEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
            console.debug("WebRTCommCall:onRtcPeerConnectionCreateAnswerErrorEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
            console.debug("WebRTCommCall:onRtcPeerConnectionCreateAnswerErrorEvent(): this.peerConnectionState="+this.peerConnectionState);
        }
        else
        {
            console.warn("WebRTCommCall:onRtcPeerConnectionCreateAnswerErrorEvent(): event ignored");        
        }
    }
    catch(exception)
    {
        console.error("WebRTCommCall:onRtcPeerConnectionCreateAnswerErrorEvent(): catched exception, exception:"+exception);
        this.onRtcPeerConnectionErrorEvent();       
    }  
}

/**
 * RTCPeerConnection listener implementation
 * @private
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionSetRemoteDescriptionSuccessEvent=function(){
    try
    {   
        console.debug("WebRTCommCall:onRtcPeerConnectionSetRemoteDescriptionSuccessEvent()");
        if(this.peerConnection)
        {
            console.debug("WebRTCommCall:onRtcPeerConnectionSetRemoteDescriptionSuccessEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
            console.debug("WebRTCommCall:onRtcPeerConnectionSetRemoteDescriptionSuccessEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
            console.debug("WebRTCommCall:onRtcPeerConnectionSetRemoteDescriptionSuccessEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
            console.debug("WebRTCommCall:onRtcPeerConnectionSetRemoteDescriptionSuccessEvent(): this.peerConnectionState="+this.peerConnectionState);

            if (this.peerConnectionState == 'answer-received') 
            {            
                this.peerConnectionState = 'established';
                // Notify closed event to listener
                if(this.webRTCommClient.eventListener.onWebRTCommCallOpenedEvent) 
                {
                    var that=this;
                    setTimeout(function(){
                        try {
                            that.webRTCommClient.eventListener.onWebRTCommCallOpenedEvent(that);
                        }
                        catch(exception)
                        {
                            console.error("WebRTCommCall:onRtcPeerConnectionSetRemoteDescriptionSuccessEvent(): catched exception in listener:"+exception);    
                        }
                    },1); 
                } 
            }
            else if (this.peerConnectionState == 'offer-received') 
            {            
                var that=this;
                var mediaContraints = {
                    mandatory:
                    {
                        OfferToReceiveAudio:this.configuration.audioMediaFlag, 
                        OfferToReceiveVideo:this.configuration.videoMediaFlag
                    }
                };
                if(window.webkitRTCPeerConnection)
                {
                    this.peerConnection.createAnswer(function(answer) {
                        that.onRtcPeerConnectionCreateAnswerSuccessEvent(answer);
                    }, function(error) {
                        that.onRtcPeerConnectionCreateAnswerErrorEvent(error);
                    }, mediaContraints);  
                }
                else if(window.mozRTCPeerConnection)
                {
                    this.peerConnection.createAnswer(function(answer) {
                        that.onRtcPeerConnectionCreateAnswerSuccessEvent(answer);
                    }, function(error) {
                        that.onRtcPeerConnectionCreateAnswerErrorEvent(error);
                    },{
                        "mandatory": {
                            "MozDontOffermessageChannel": true
                        }
                    }); 
                } 
            }
            else {
                console.error("WebRTCommCall:onRtcPeerConnectionSetRemoteDescriptionSuccessEvent(): RTCPeerConnection bad state!");
            }
        }
        else
        {
            console.warn("WebRTCommCall:onRtcPeerConnectionSetRemoteDescriptionSuccessEvent(): event ignored");        
        }
    }
    catch(exception)
    {
        console.error("WebRTCommCall:onRtcPeerConnectionSetRemoteDescriptionSuccessEvent(): catched exception, exception:"+exception);
        this.onRtcPeerConnectionErrorEvent();      
    }
}

/**
 * RTCPeerConnection listener implementation
 * @private
 * @param {String} error  SDP error
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionSetRemoteDescriptionErrorEvent=function(error){
    try
    { 
        console.error("WebRTCommCall:onRtcPeerConnectionSetRemoteDescriptionErrorEvent():error="+JSON.stringify(error));
        if(this.peerConnection)
        {
            console.debug("WebRTCommCall:onRtcPeerConnectionSetRemoteDescriptionErrorEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
            console.debug("WebRTCommCall:onRtcPeerConnectionSetRemoteDescriptionErrorEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
            console.debug("WebRTCommCall:onRtcPeerConnectionSetRemoteDescriptionErrorEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
            console.debug("WebRTCommCall:onRtcPeerConnectionSetRemoteDescriptionErrorEvent(): this.peerConnectionState="+this.peerConnectionState);
            throw "WebRTCommCall:onRtcPeerConnectionSetRemoteDescriptionErrorEvent():error="+error;
        }
        else
        {
            console.warn("WebRTCommCall:onRtcPeerConnectionSetRemoteDescriptionErrorEvent(): event ignored");        
        }
    }
    catch(exception)
    {
        this.onRtcPeerConnectionErrorEvent(error);      
    }
}

/**
 * RTCPeerConnection listener implementation
 * @private
 * @param {Event} event  RTCPeerConnection open event
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionOnOpenEvent=function(event){
    console.debug("WebRTCommCall:onRtcPeerConnectionOnOpenEvent(): event="+event); 
    if(this.peerConnection)
    {
        console.debug("WebRTCommCall:onRtcPeerConnectionOnOpenEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);   
        console.debug("WebRTCommCall:onRtcPeerConnectionOnOpenEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);   
        console.debug("WebRTCommCall:onRtcPeerConnectionOnOpenEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
        console.debug("WebRTCommCall:onRtcPeerConnectionOnOpenEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
        console.debug("WebRTCommCall:onRtcPeerConnectionOnOpenEvent(): this.peerConnectionState="+this.peerConnectionState);
    }
    else
    {
        console.warn("WebRTCommCall:onRtcPeerConnectionOnOpenEvent(): event ignored");        
    }
}

/**
 * RTCPeerConnection listener implementation
 * @private
 * @param {Event} event  RTCPeerConnection open event
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionStateChangeEvent=function(event){
    console.debug("WebRTCommCall:onRtcPeerConnectionStateChangeEvent(): event="+event); 
    if(this.peerConnection)
    {
        console.debug("WebRTCommCall:onRtcPeerConnectionStateChangeEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);   
        console.debug("WebRTCommCall:onRtcPeerConnectionStateChangeEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
        console.debug("WebRTCommCall:onRtcPeerConnectionStateChangeEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
        console.debug("WebRTCommCall:onRtcPeerConnectionStateChangeEvent(): this.peerConnectionState="+this.peerConnectionState);
        if(this.peerConnection && this.peerConnection.signalingState=='closed') this.peerConnection=null;
    }
    else
    {
        console.warn("WebRTCommCall:onRtcPeerConnectionStateChangeEvent(): event ignored");        
    }
}

/**
 * RTCPeerConnection listener implementation
 * @private
 * @param {Event} event  RTCPeerConnection ICE negociation Needed event
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionIceNegotiationNeededEvent=function(event){
    console.debug("WebRTCommCall:onRtcPeerConnectionIceNegotiationNeededEvent():event="+event);
    if(this.peerConnection)
    {
        console.debug("WebRTCommCall:onRtcPeerConnectionIceNegotiationNeededEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
        console.debug("WebRTCommCall:onRtcPeerConnectionIceNegotiationNeededEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
        console.debug("WebRTCommCall:onRtcPeerConnectionIceNegotiationNeededEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
        console.debug("WebRTCommCall:onRtcPeerConnectionIceNegotiationNeededEvent(): this.peerConnectionState="+this.peerConnectionState);
    }
    else
    {
        console.warn("WebRTCommCall:onRtcPeerConnectionIceNegotiationNeededEvent(): event ignored");        
    }
}

/**
 * RTCPeerConnection listener implementation
 * @private
 * @param {Event} event  RTCPeerConnection ICE change event
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionGatheringChangeEvent=function(event){
    console.debug("WebRTCommCall:onRtcPeerConnectionGatheringChangeEvent():event="+event);
    if(this.peerConnection)
    {
        console.debug("WebRTCommCall:onRtcPeerConnectionGatheringChangeEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
        console.debug("WebRTCommCall:onRtcPeerConnectionGatheringChangeEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
        console.debug("WebRTCommCall:onRtcPeerConnectionGatheringChangeEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
        console.debug("WebRTCommCall:onRtcPeerConnectionGatheringChangeEvent(): this.peerConnectionState="+this.peerConnectionState);
    
        if(this.peerConnection.signalingState != 'closed')
        {
            if(this.peerConnection.iceGatheringState=="complete")
            {
                if(window.webkitRTCPeerConnection)
                {
                    if(this.peerConnectionState == 'preparing-offer') 
                    {
                        this.connector.invite(this.peerConnection.localDescription.sdp)
                        this.peerConnectionState = 'offer-sent';
                    } 
                    else if (this.peerConnectionState == 'preparing-answer') 
                    {
                        this.connector.accept(this.peerConnection.localDescription.sdp)
                        this.peerConnectionState = 'established';
                        // Notify opened event to listener
                        if(this.webRTCommClient.eventListener.onWebRTCommCallOpenedEvent) 
                        {
                            var that=this;
                            setTimeout(function(){
                                try {
                                    that.webRTCommClient.eventListener.onWebRTCommCallOpenedEvent(that);
                                }
                                catch(exception)
                                {
                                    console.error("WebRTCommCall:onRtcPeerConnectionGatheringChangeEvent(): catched exception in listener:"+exception);    
                                }
                            },1); 
                        }
                    }
                    else if (this.peerConnectionState == 'established') 
                    {
                    // Why this last ice candidate event?
                    } 
                    else
                    {
                        console.error("WebRTCommCall:onRtcPeerConnectionGatheringChangeEvent(): RTCPeerConnection bad state!");
                    }
                }
            }
        }
        else
        {
            console.error("WebRTCommCall:onRtcPeerConnectionGatheringChangeEvent(): RTCPeerConnection closed!");
        }
    }
    else
    {
        console.warn("WebRTCommCall:onRtcPeerConnectionGatheringChangeEvent(): event ignored");        
    }
}

/**
 * RTCPeerConnection listener implementation
 * @private
 * @param {Event} event  RTCPeerConnection open event
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionIceChangeEvent=function(event){
    console.debug("WebRTCommCall:onRtcPeerConnectionIceChangeEvent():event="+event); 
    if(this.peerConnection)
    {
        console.debug("WebRTCommCall:onRtcPeerConnectionIceChangeEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
        console.debug("WebRTCommCall:onRtcPeerConnectionIceChangeEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
        console.debug("WebRTCommCall:onRtcPeerConnectionIceChangeEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
        console.debug("WebRTCommCall:onRtcPeerConnectionIceChangeEvent(): this.peerConnectionState="+this.peerConnectionState);
    }
    else
    {
        console.warn("WebRTCommCall:onRtcPeerConnectionIceChangeEvent(): event ignored");        
    }
}

/**
 * RTCPeerConnection listener implementation
 * @private
 * @param {Event} event  RTCPeerConnection identity event
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionIdentityResultEvent=function(event){
    console.debug("WebRTCommCall:onRtcPeerConnectionIdentityResultEvent():event="+event);
    if(this.peerConnection)
    {
        console.debug("WebRTCommCall:onRtcPeerConnectionIdentityResultEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
        console.debug("WebRTCommCall:onRtcPeerConnectionIdentityResultEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
        console.debug("WebRTCommCall:onRtcPeerConnectionIdentityResultEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
        console.debug("WebRTCommCall:onRtcPeerConnectionIdentityResultEvent(): this.peerConnectionState="+this.peerConnectionState);
    }
    else
    {
        console.warn("WebRTCommCall:onRtcPeerConnectionIdentityResultEvent(): event ignored");        
    }
}

/**
 * RTCPeerConnection listener implementation
 * @private
 * @param {Event} event  RTCPeerConnection data channel event
 */ 
WebRTCommCall.prototype.onRtcPeerConnectionOnMessageChannelEvent=function(event){
    console.debug("WebRTCommCall:onRtcPeerConnectionOnMessageChannelEvent():event="+JSON.stringify(event));
    if(this.peerConnection)
    {
        console.debug("WebRTCommCall:onRtcPeerConnectionOnMessageChannelEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
        console.debug("WebRTCommCall:onRtcPeerConnectionOnMessageChannelEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
        console.debug("WebRTCommCall:onRtcPeerConnectionOnMessageChannelEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
        console.debug("WebRTCommCall:onRtcPeerConnectionOnMessageChannelEvent(): this.peerConnectionState="+this.peerConnectionState);
        this.messageChannel=event.channel;
        console.debug("WebRTCommCall:onRtcPeerConnectionOnMessageChannelEvent(): this.messageChannel.label="+this.messageChannel.label); 
        console.debug("WebRTCommCall:onRtcPeerConnectionOnMessageChannelEvent(): this.messageChannel.reliable="+this.messageChannel.reliable); 
        console.debug("WebRTCommCall:onRtcPeerConnectionOnMessageChannelEvent(): this.messageChannel.binaryType="+this.messageChannel.binaryType);
        var that=this;
        this.messageChannel.onopen = function(event) {
            that.onRtcPeerConnectionMessageChannelOnOpenEvent(event);
        }  
        this.messageChannel.onclose = function(event) {
            that.onRtcPeerConnectionMessageChannelOnClose(event);
        }  
        this.messageChannel.onerror = function(event) {
            that.onRtcPeerConnectionMessageChannelOnErrorEvent(event);
        } 
        this.messageChannel.onmessage = function(event) {
            that.onRtcPeerConnectionMessageChannelOnMessageEvent(event);
        }  
    }
    else
    {
        console.warn("WebRTCommCall:onRtcPeerConnectionOnMessageChannelEvent(): event ignored");        
    }
}

WebRTCommCall.prototype.onRtcPeerConnectionMessageChannelOnOpenEvent=function(event){
    console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnOpenEvent():event="+event);
    if(this.peerConnection)
    {
        console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnOpenEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
        console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnOpenEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
        console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnOpenEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
        console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnOpenEvent(): this.peerConnectionState="+this.peerConnectionState);
        if(this.messageChannel)
        {
            console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnOpenEvent(): this.messageChannel.readyState="+this.messageChannel.readyState);  
            console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnOpenEvent(): this.messageChannel.binaryType="+this.messageChannel.bufferedAmmount);
        }
    }
    else
    {
        console.warn("WebRTCommCall:onRtcPeerConnectionMessageChannelOnOpenEvent(): event ignored");        
    }
}

WebRTCommCall.prototype.onRtcPeerConnectionMessageChannelOnClose=function(event){
    console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnClose():event="+event);
    if(this.peerConnection)
    {
        console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnClose(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
        console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnClose(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
        console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnClose(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
        console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnClose(): this.peerConnectionState="+this.peerConnectionState);
        if(this.messageChannel)
        {
            console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnClose(): this.messageChannel.readyState="+this.messageChannel.readyState);  
            console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnClose(): this.messageChannel.binaryType="+this.messageChannel.bufferedAmmount);
        }
    }
    else
    {
        console.warn("WebRTCommCall:onRtcPeerConnectionMessageChannelOnClose(): event ignored");        
    }
}
 
WebRTCommCall.prototype.onRtcPeerConnectionMessageChannelOnErrorEvent=function(event){
    console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnErrorEvent():event="+event);
    if(this.peerConnection)
    {
        console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnErrorEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
        console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnErrorEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
        console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnErrorEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
        console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnErrorEvent(): this.peerConnectionState="+this.peerConnectionState);
        if(this.messageChannel)
        {
            console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnErrorEvent(): this.messageChannel.readyState="+this.messageChannel.readyState);  
            console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnErrorEvent(): this.messageChannel.binaryType="+this.messageChannel.bufferedAmmount);
        }
    }
    else
    {
        console.warn("WebRTCommCall:onRtcPeerConnectionMessageChannelOnErrorEvent(): event ignored");        
    }
}

WebRTCommCall.prototype.onRtcPeerConnectionMessageChannelOnMessageEvent=function(event){
    console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnMessageEvent():event="+event);
    if(this.peerConnection)
    {
        console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnMessageEvent(): this.peerConnection.signalingState="+this.peerConnection.signalingState);
        console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnMessageEvent(): this.peerConnection.iceGatheringState="+this.peerConnection.iceGatheringState);
        console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnMessageEvent(): this.peerConnection.iceConnectionState="+this.peerConnection.iceConnectionState); 
        console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnMessageEvent(): this.peerConnectionState="+this.peerConnectionState);
        if(this.messageChannel)
        {
            console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnMessageEvent(): this.messageChannel.readyState="+this.messageChannel.readyState);  
            console.debug("WebRTCommCall:onRtcPeerConnectionMessageChannelOnMessageEvent(): this.messageChannel.binaryType="+this.messageChannel.bufferedAmmount);
            if(this.webRTCommClient.eventListener.onWebRTCommCallMessageEvent)
            {
                var that=this;
                setTimeout(function(){
                    try {
                        that.webRTCommClient.eventListener.onWebRTCommCallMessageEvent(that, event.data);
                    }
                    catch(exception)
                    {
                        console.error("WebRTCommCall:onRtcPeerConnectionMessageChannelOnMessageEvent(): catched exception in listener:"+exception);    
                    }
                },1);
            }  
        }
    }
    else
    {
        console.warn("WebRTCommCall:onRtcPeerConnectionMessageChannelOnMessageEvent(): event ignored");        
    }
}

/**
 * Modifiy SDP based on configured codec filter
 * @private
 * @param {SessionDescription} sessionDescription  JAIN (gov.nist.sdp) SDP offer object 
 */ 
WebRTCommCall.prototype.applyConfiguredCodecFilterOnSessionDescription=function(sessionDescription){ 
    if(sessionDescription instanceof SessionDescription)
    {
        try
        {
            console.debug("WebRTCommCall:applyConfiguredCodecFilterOnSessionDescription(): sessionDescription="+sessionDescription); 
            // Deep copy the media descriptions
            var mediaDescriptions = sessionDescription.getMediaDescriptions(false);
            for (var i = 0; i <  mediaDescriptions.length; i++) 
            {
                var mediaDescription = mediaDescriptions[i];
                var mediaField = mediaDescription.getMedia();
                var mediaType = mediaField.getType();
                if(mediaType=="audio" &&  this.configuration.audioCodecsFilter)
                {
                    var offeredAudioCodecs = this.getOfferedCodecsInMediaDescription(mediaDescription);
                    // Filter offered codec
                    var splitAudioCodecsFilters = (this.configuration.audioCodecsFilter).split(",");
                    this.applyCodecFiltersOnOfferedCodecs(offeredAudioCodecs, splitAudioCodecsFilters);
                    // Apply modification on audio media description
                    this.updateMediaDescription(mediaDescription, offeredAudioCodecs, splitAudioCodecsFilters);
                }
                else if(mediaType=="video" && this.configuration.videoCodecsFilter)
                {
                    var offeredVideoCodecs = this.getOfferedCodecsInMediaDescription(mediaDescription); 
                    // Filter offered codec
                    var splitVideoCodecFilter = (this.configuration.videoCodecsFilter).split(",");
                    this.applyCodecFiltersOnOfferedCodecs(offeredVideoCodecs, splitVideoCodecFilter);
                    // Apply modification on video media description
                    this.updateMediaDescription(mediaDescription, offeredVideoCodecs, splitVideoCodecFilter);
                }
            }
        }
        catch(exception)
        {
            console.error("WebRTCommCall:applyConfiguredCodecFilterOnSessionDescription(): catched exception, exception:"+exception);
            throw exception;
        }
    }
    else 
    {
        throw "WebRTCommCall:applyConfiguredCodecFilterOnSessionDescription(): bad arguments"      
    }
}

/**
 * Get offered codecs in media description
 * @private
 * @param {MediaDescription} mediaDescription  JAIN (gov.nist.sdp) MediaDescription object 
 * @return offeredCodec JSON object { "0":"PCMU", "111":"OPUS", .....} 
 */ 
WebRTCommCall.prototype.getOfferedCodecsInMediaDescription=function(mediaDescription){ 
    console.debug("WebRTCommCall:getOfferedCodecsInMediaDescription()");
    if(mediaDescription instanceof MediaDescription)
    {
        var mediaFormats = mediaDescription.getMedia().getFormats(false);
        var foundCodecs = {};
                    
        // Set static payload type and codec name
        for(var j = 0; j <  mediaFormats.length; j++) 
        {
            var payloadType = mediaFormats[j];
            console.debug("WebRTCommCall:getOfferedCodecsInMediaDescription(): payloadType="+payloadType); 
            console.debug("WebRTCommCall:getOfferedCodecsInMediaDescription(): this.codecNames[payloadType]="+this.codecNames[payloadType]); 
            foundCodecs[payloadType]=this.codecNames[payloadType];
        }
                    
        // Set dynamic payload type and codec name 
        var attributFields = mediaDescription.getAttributes();
        for(var k = 0; k <  attributFields.length; k++) 
        {
            var attributField = attributFields[k];
            console.debug("WebRTCommCall:getOfferedCodecsInMediaDescription(): attributField.getName()="+attributField.getName()); 
            if(attributField.getName()=="rtpmap")
            {
                try
                {
                    var rtpmapValue = attributField.getValue(); 
                    var splitRtpmapValue = rtpmapValue.split(" ");
                    var payloadType = splitRtpmapValue[0];
                    var codecInfo = splitRtpmapValue[1];
                    var splittedCodecInfo = codecInfo.split("/");
                    var codecName = splittedCodecInfo[0];
                    foundCodecs[payloadType]=codecName.toUpperCase();
                    console.debug("WebRTCommCall:getOfferedCodecsInMediaDescription(): payloadType="+payloadType); 
                    console.debug("WebRTCommCall:getOfferedCodecsInMediaDescription(): codecName="+codecName); 
                }
                catch(exception)
                {
                    console.error("WebRTCommCall:getOfferedCodecsInMediaDescription(): rtpmap/fmtp format not supported");  
                }
            }
        }
        return foundCodecs;
    }
    else 
    {
        throw "WebRTCommCall:getOfferedCodecsInMediaDescription(): bad arguments"      
    }
}

/**
 * Get offered codec list
 * @private
 * @param {JSON object} foundCodecs  
 * @param {Array} codecFilters  
 */ 
WebRTCommCall.prototype.applyCodecFiltersOnOfferedCodecs=function(foundCodecs, codecFilters){ 
    console.debug("WebRTCommCall:applyCodecFiltersOnOfferedCodecs()");
    if(typeof(foundCodecs)=='object' && codecFilters instanceof Array)
    {
        for(var offeredMediaCodecPayloadType in foundCodecs){
            var filteredFlag=false;
            for(var i=0; i<codecFilters.length;i++ )
            {
                if ( foundCodecs[offeredMediaCodecPayloadType] == codecFilters[i] ) { 
                    filteredFlag=true;
                    break;
                } 
            }
            if(filteredFlag==false)
            {
                delete(foundCodecs[offeredMediaCodecPayloadType]);     
            }
        }
    }
    else 
    {
        throw "WebRTCommCall:applyCodecFiltersOnOfferedCodecs(): bad arguments"      
    }
}

/**
 * Update offered media description avec configured filters
 * @private
 * @param {MediaDescription} mediaDescription  JAIN (gov.nist.sdp) MediaDescription object 
 * @param {JSON object} filteredCodecs 
 * @param {Array} codecFilters  
 */ 
WebRTCommCall.prototype.updateMediaDescription=function(mediaDescription, filteredCodecs, codecFilters){ 
    console.debug("WebRTCommCall:updateMediaDescription()");
    if(mediaDescription instanceof MediaDescription  && typeof(filteredCodecs)=='object' && codecFilters instanceof Array)
    {
        // Build new media field format lis
        var newFormatListArray=new Array();
        for(var i=0;i<codecFilters.length;i++)
        {
            for(var offeredCodecPayloadType in filteredCodecs)
            {
                if (filteredCodecs[offeredCodecPayloadType] == codecFilters[i] ) { 
                    newFormatListArray.push(offeredCodecPayloadType);
                    break;
                } 
            }
        }
        mediaDescription.getMedia().setFormats(newFormatListArray);
        // Remove obsolte rtpmap attributs 
        var newAttributeFieldArray=new Array();
        var attributFields = mediaDescription.getAttributes();
        for(var k = 0; k <  attributFields.length; k++) 
        {
            var attributField = attributFields[k];
            console.debug("WebRTCommCall:updateMediaDescription(): attributField.getName()="+attributField.getName()); 
            if(attributField.getName()=="rtpmap" || attributField.getName()=="fmtp")
            {
                try
                {
                    var rtpmapValue = attributField.getValue(); 
                    var splitedRtpmapValue = rtpmapValue.split(" ");
                    var payloadType = splitedRtpmapValue[0];
                    if(filteredCodecs[payloadType]!=undefined) 
                        newAttributeFieldArray.push(attributField);
                }
                catch(exception)
                {
                    console.error("WebRTCommCall:updateMediaDescription(): rtpmap/fmtp format not supported");  
                }
            }
            else newAttributeFieldArray.push(attributField);
        }
        mediaDescription.setAttributes(newAttributeFieldArray);
    }
    else 
    {
        throw "WebRTCommCall:updateMediaDescription(): bad arguments"      
    }
}

/**
 * Modifiy SDP based on configured codec filter
 * @private
 * @param {SessionDescription} sessionDescription  JAIN (gov.nist.sdp) SDP offer object 
 * @param {String} mediaTypeToRemove  audi/video 
 */ 
WebRTCommCall.prototype.removeMediaDescription=function(sessionDescription, mediaTypeToRemove){ 
    console.debug("WebRTCommCall:removeMediaDescription()");
    if(sessionDescription instanceof SessionDescription)
    {
        try
        {
            var mediaDescriptions = sessionDescription.getMediaDescriptions(false);
            for (var i = 0; i <  mediaDescriptions.length; i++) 
            {
                var mediaDescription = mediaDescriptions[i];
                var mediaField = mediaDescription.getMedia();
                var mediaType = mediaField.getType();
                if(mediaType==mediaTypeToRemove)
                {
                    mediaDescriptions.remove(i);
                    break;
                }
            }
        }
        catch(exception)
        {
            console.error("WebRTCommCall:removeMediaDescription(): catched exception, exception:"+exception);
            throw exception;
        }
    }
    else 
    {
        throw "WebRTCommCall:removeMediaDescription(): bad arguments"      
    }
}

