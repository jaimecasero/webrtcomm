/*
 * TeleStax, Open Source Cloud Communications  Copyright 2012. 
 * and individual contributors
 * by the @authors tag. See the copyright.txt in the distribution for a
 * full listing of individual contributors.
 *
 * This is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation; either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this software; if not, write to the Free
 * Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301 USA, or see the FSF site: http://www.fsf.org.
 */

/*
 *  Implementation of the JAIN-SIP AuthorizationParser .
 *  @see  gov/nist/javax/sip/parser/AuthorizationParser.java 
 *  @author Yuemin Qin (yuemin.qin@orange.com)
 *  @author Laurent STRULLU (laurent.strullu@orange.com)
 *  @version 1.0 
 *   
 */
function AuthorizationParser() {
    if(logger!=undefined) logger.debug("AuthorizationParser:AuthorizationParser()");
    this.classname="AuthorizationParser"; 
    if(typeof arguments[0]=="object")
    {
        var lexer=arguments[0];
        this.lexer = lexer;
        this.lexer.selectLexer("command_keywordLexer");
    }
    else if(typeof arguments[0]=="string")
    {
        var authorization=arguments[0];
        this.lexer = new Lexer("command_keywordLexer", authorization);
    }
}

AuthorizationParser.prototype = new ChallengeParser();
AuthorizationParser.prototype.constructor=AuthorizationParser;

AuthorizationParser.prototype.parse =function(){
    if(logger!=undefined) logger.debug("AuthorizationParser:parse()");
    this.headerName(TokenTypes.prototype.AUTHORIZATION);
    var auth = new Authorization();
    ChallengeParser.prototype.parse.call(this,auth);//used to call the method of challengeparser
    return auth;
}

