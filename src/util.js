/**
 * @package ng-util
 * @author Garrett Morris <gmorris_89@outlook.com>
 * @license MIT
 * @version 1.0.4
 */
!function(angular){
	
	var mod = angular.module('ng-util',[]);

	mod.config(['$controllerProvider','$compileProvider','$filterProvider','$provide',function($controllerProvider,$compileProvider,$filterProvider,$provide){
		
		mod.$controllerProvider = $controllerProvider;
		mod.$filterProvider = $filterProvider;
		mod.$provide = $provide;
		mod.$compileProvider = $compileProvider;
		
		var map = {
			controller: ['$controllerProvider','register'],
			filter: ['$filterProvider','register'],
			service: ['$provide','service'],
			factory: ['$provide','factory'],
			value: ['$provide','value'],
			constant: ['$provide','constant'],
			directive: ['$compileProvider','directive'],
			component: ['$compileProvider','component']
		};
		
		var bootStrapped = [];
		
		var mFunc = angular.module;

		angular.module = function(){
			
			var app = mFunc.apply(this,arguments);
			
			//only override properties once.
			if(bootStrapped.indexOf(arguments[0]) == -1){
				for(var type in map){
					
					var c = mod;
					
					var d = map[type];
					
					for(var i=0;i<d.length;i++){
						c = c[d[i]];// recurse until reaching the function
					}
					//now inject the function into an IIFE so we ensure its scoped properly
					!function(app,type,c){
						app[type] = function(){
							c.apply(this,arguments);
							return this;//return the app instance for chaining.
						}.bind(app);	
					}(app,type,c);
				}	
				bootStrapped.push(arguments[0]);//mark this instance as properly monkey patched
			}
			
			return app;
			
		}.bind(angular);	
		
	}]);

	mod.provider('$util',function(){
		
		var _config = {
			cacheBust: false,
			extend: function(){}
		};
		
		this.config = function(config){
			for(var key in config){
				_config[key] = config[key];
			}
		};
		
		this.$get = ['$timeout','$q',function($timeout,$q){
		
			function $util(){
				
				if(typeof _config.extend == 'function'){
					_config.extend(this);
				}
				
			}
			
			var Util = {
				
				// void async( Array items, Function eachFn, Function callbackFn )
				async: function( items, eachFn, callbackFn ){
					var itemsLength = items.length,
						i=0,
						returned = new Array(itemsLength).fill(0),
						results = new Array(itemsLength).fill(null),
						errors = new Array(itemsLength).fill(null);
					
					function loop(i,item){
						function next( error, result ){
							if(error){
								errors[i] = error;
							} 
							if(result){
								results[i] = result;
							}
							returned[i] = 1;
							if(returned.indexOf(0) == -1){
								if(errors.toString().replace(/,/g,'') == ''){
									errors = null;
								}else{
									errors.join("\r\n----------\r\n");
								}
								callbackFn(errors,results);
							}
						}
						eachFn(item,next);
					}
					
					for(i;i<itemsLength;i++){
						loop(i,items[i]);
					}
				},
				
				// void sync( Array items, Function eachFn, Function callbackFn )
				sync: function( items, eachFn, callbackFn ){
			
					var results = [], 
						errors = [];
						
					function next(error,result){
						if(error != null) {
							errors.push(error);
						}
						if(result != undefined) {
							results.push(result);
						}
						if(items.length == 0){
							if(errors.toString().replace(/,/g,'') == ''){
								errors = null;
							}else{
								errors.join("\r\n----------\r\n");
							}
							return callbackFn(errors,results);
						}else{
							//pop first item, pass it to eachCb with the next function
							eachFn(items.shift(),next);
						}
					};
					
					eachFn(items.shift(),next);
					
				},
				
				// void loadOne( String type, String url, Function cb, Function err )
				loadOne: function( type, url, cb, err ) {
					
					if(!cb){
						cb = function(){};
					}
					if(!err){
						err = function(){};
					}
					
					var types = ['script','link'];
					if(types.indexOf(type) == -1){
						throw new Error('only scripts and links supported');
					}
					
					var id = url.replace(/\W+/g, "");
					
					if(_config.cacheBust){
						url +='?_v='+(new Date()).getTime();
					}
					
					if(!$('#'+id).length){
						var el = document.createElement(type);
						if(type == 'link'){
							
							el.rel = 'stylesheet';
							el.href = url;
							el.id = id;
							document.head.appendChild(el);
							cb();
						}
						else if(type == 'script'){
							
							el.id = id;
							el.src = url;
							el.addEventListener('load',function(){
								cb();
							},false);
							el.addEventListener('error',function(){ err(arguments); },false);
							document.body.appendChild(el);
						}
					}else{
						
						cb();
					}
				},
				
				// Promise load( Array files )
				load: function (){
					
					args = Array.prototype.slice.call(arguments);
					
					args = this.flatten(args);//flatten args
					
					var iteratorType = 'async';
					
					var items = args;
					//if first argument is sync or async or true false, treat is an instruction.
					var first = items[0];
					if([true,false,'sync','async'].indexOf(first) != -1){
						items.shift();//remove first item
						iteratorType = first == true ? 'sync' : first == 'sync' ? 'sync' : 'async';
					}
					
					//now flatten items to be sure.
					
					
					var _self = this;

					return $q(function(resolve,reject){
						if(items.length == 0){
							return resolve();
						}
						_self[iteratorType]( items, function(item,next){
							if(item.indexOf('.js') != -1){
								_self.loadOne('script',item,next,function(err){
									next(err);
								});	
							}
							else if(item.indexOf('.css') != -1){
								_self.loadOne('link',item,next);
							}else{
								
								next();
							}
						},function(errors,results){
							$timeout(function() {
								if(errors){
									reject(errors);
								}else{
									resolve();
								}
							});
						});
					});
					
				},

				// String uuid_v4()
				// Taken from: http://stackoverflow.com/a/2117523/2401804
				uuid_v4 : function() {
					return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
						var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
						return v.toString(16);
					});
				},
				
				// flatten( Array arr )
				flatten: function flatten( arr ){
					var _self = this;
					return arr.reduce(function(acc, val){ 
					  return acc.concat( Array.isArray(val) ? _self.flatten(val) : val );
					},[]);
				}
				
				
				
			};
			
			$util.prototype = Util;
			
			return new $util();
			
		}];
		
	})

	//directives

	// adds filechange listener to file elements, curiously missing from angularjs
	// <input ng-filechange="someFunc(files)" />
	.directive('ngFilechange', function() {
	  return {
		restrict: 'A',
		scope: {
			ngFilechange: '&'
		},
		link: function (scope, element, attrs) {
		  element.bind('change', function() {
			scope.$apply(function() {
			  var files = element[0].files;
			  if (files) {
				scope.ngFilechange({ files: files });
			  }
			});
		  });
		}
	  };
	})


	// filters

	// same as php uc_words() function. capitalizes every word in string.
	// <span>{{ someProperty|uc_words }}</span> 
	.filter('uc_words', function() {
		return function(input) {
			var str = [];
			var a = input.split(' ');
			for(var i=0;i<a.length;i++){
				if(!!a[i]) str.push(a[i].charAt(0).toUpperCase() + a[i].substr(1).toLowerCase());
			}
			return str.join(' ');
		}
	});	
}(angular);