



//!Character model
var Character = Backbone.Model.extend({
	
	localStorage: new Backbone.LocalStorage("osr-random-generator-npcs"),
	
	defaults: function() {
		return {
			rules_set: app.AppSettings.get('rules_set'),
			name_type: 'none',
			name: '',
			chargroup: '',
			gender: '',
			race: 'human',
			ability_scores: [],
			charclass: 'none',
			spellcaster: false,
			level: 0,
			hp: 0,
			ac: 10,
			attack: {
				base:0, 
				melee:0, 
				missile:0,
			},
			spells: {},
			personality: [],
			appearance: [],
			goal: '',
			armor: '',
			weapon: '',
			reaction_roll: 0
		}
	},
		
		
	initialize:  function() {
		
	},
	
	
	getRules: function() {
		return appdata.rules[this.get('rules_set')];
	},

			
	checkSpellCaster: function() {
		this.set({ spellcaster: false }, { silent: true });
		if (this.getRules().classes[this.get('charclass')].spellcaster == true) {
			this.set({ spellcaster: true }, { silent: true });
			return true;
		}
		return false;
	},
	
	calcModifier: function(att, score) {
		if (typeof this.getRules().ability_scores_mod[att] !== 'undefined') {
			return this.getRules().ability_scores_mod[att][score];
		}
		return this.getRules().ability_scores_mod.general[score];
	},
	
	getAttScore: function(att){
		a = _.findWhere(this.get('ability_scores'), { name: att});
		return a.score;
	},
	
	
	getAttMod: function(att){
		a = _.findWhere(this.get('ability_scores'), { name: att});
		return a.modifier;
	},
	
	
	holmesname: function(gender) {
		var name = '';
		scount = app.randomizer.getWeightedRandom(appdata.name.holmesian_scount.values, appdata.name.holmesian_scount.weights);
	
		for (i=1; i<=scount; i++) {
			name += app.randomizer.randomValue(appdata.name.holmesian_syllables);
			if (i<scount) {
				name += app.randomizer.getWeightedRandom(['',' ','-'],[3,2,2]);
			}
		}
		name = name.toLowerCase().capitalize();
		name += ' '+app.randomizer.randomValue(appdata.name.holmesian_title);
		
		name = app.randomizer.findToken(name);
		
		name = name.replace(/[\s\-]([a-z]{1})/g, function(match) {
			//console.log(match);
			return match.toUpperCase();
		});
		
		return name;
	},
	
	generateName: function(name_type) {
		var gender = this.get('gender');
		var name = '';
		switch (name_type) {
		 	case "holmesian":
				name = this.holmesname(gender);
				break;
			case "cornish":
			case "flemish":
			default:
				
				name = app.randomizer.randomValue(appdata.name[name_type][gender]);
				
				if (_.random(1, 20) > 10) {
					name += ' '+app.randomizer.randomValue(appdata.name[name_type]['surname']);
				}
				
				name = app.randomizer.findToken(name);
				
				break;
		}
		return name;
	},
	
	calcGender: function() {
		this.set('gender', app.randomizer.randomValue(['male', 'female']));
	},
	
	rollAbilities: function() {
		var ability_scores = [];
		for (var att in this.getRules().ability_scores) {
		    if (this.getRules().ability_scores.hasOwnProperty(att)) {
				a = { name: att, score: 0, modifier: 0 };
				if (this.get('charclass') == 'none') {
					a.score = app.randomizer.roll(6,3);
				} else {
					//use 4d6 drop lowest for classed npcs
					var arolls = [];
					arolls.push(app.randomizer.roll(6)); arolls.push(app.randomizer.roll(6)); arolls.push(app.randomizer.roll(6)); arolls.push(app.randomizer.roll(6));
					arolls.sort(function(a, b) { return a - b; }).reverse();
					a.score = arolls[0] + arolls[1] + arolls[2];
				}
				
				a.modifier = this.calcModifier(a.name, a.score);
				ability_scores.push(a);
		    }
		}
		this.set('ability_scores', ability_scores);
	},
	
	selectClass: function() {
		var cclass = this.get('charclass');
		if (cclass == 'random') {
			this.set('charclass', app.randomizer.getWeightedRandom(this.getRules().classes.random.options, this.getRules().classes.random.weight) );
		} else if (cclass == 'none') {
			this.selectOccupation();
		}
	},
	
	selectOccupation: function() {
		var occ = app.randomizer.randomValue(appdata.occupations);
		this.set('occupation', occ.name);
	},
	
	selectArmor: function() {
		var charclass = this.get('charclass');
		if (charclass == 'none') {
			var occ = _.findWhere(appdata.occupations, { name: this.get('occupation') });
			if (typeof occ.armor == 'undefined') { return ''; }
			if (occ.armor == false) { return ''; }
		}
		return app.randomizer.randomValue(this.getRules().classes[charclass]['armor']);
	},
	
	setLevel:  function() {
		var lvl = this.get('level');
		var curclass = this.get('charclass');
		if (curclass == 'none') {
			lvl = 0;
		} else if (lvl == "random") {
			lvl = _.random(1,9);
		} else if (lvl == 0 && this.get('charclass') !== 'none') {
			lvl = 1;
		}
		this.set('level', lvl);
	},
	
	//randomly choose spells
	selectSpells: function() {
		if (this.checkSpellCaster() == true) {
			var spelluse = this.getRules().classes[this.get('charclass')].spells[this.get('level') - 1];
			var selected = {};
			for(var i=0; i < spelluse.length; i++) {
				var level = i+1;
				lvl = 'lvl'+level;
				var sp = [];
				for (j=0; j < spelluse[i]; j++) {
					sp.push( _.sample(appdata.spells.bylevel[this.get('charclass')][lvl]) );
				}
				selected['Level '+level] = sp;
			}
			
			this.set('spells', selected);
		}
	},
	
	
	rollHp: function() {
		var hp = 0;
		var conmod = this.getAttMod('con');
		//console.log('conmod: '+conmod);
		if (this.get('charclass') == 'none') {
			hp = app.randomizer.roll(this.getRules().classes[this.get('charclass')].hd, 1, conmod);
			//console.log('roll: '+hp);
		} else {
			for(i=1;i<=this.get('level');i++) {
				var r = app.randomizer.roll(this.getRules().classes[this.get('charclass')].hd, 1, conmod);
				//console.log('roll: '+r);
				//r += conmod;
				if (r < 1) { r = 1; }
				hp += r;
			}
		}		
		if (hp < 1) { hp = 1; }
		this.set('hp', hp);
	},
	
	calcAttack: function() {
		var attack = {};
		attack.base = this.getRules().classes[this.get('charclass')].attack(this.get('level'));
		attack.melee = attack.base + parseInt(this.getAttMod('str'));
		attack.missile = attack.base + parseInt(this.getAttMod('dex'));
		
		if (attack.melee > 0) {
			attack.melee = '+'+attack.melee;
		}
		if (attack.missile > 0) {
			attack.missile = '+'+attack.missile;
		}
		
		this.set('attack', attack);		
	},
	
	calcAC: function() {
		
		var ac = parseInt(this.getRules().armorclass.base);
		var method = this.getRules().armorclass.method;
		var armor = this.get('armor');

		if (armor !== '') {
			var armordata = _.findWhere(this.getRules().armor, { name: armor });
			//console.log(armordata);
			if (armordata.ac_base > 0) { ac = armordata.ac_base; }
			if (armordata.ac_bonus > 0) {
				if (method == 'asc') {
					ac = ac + parseInt(armordata.ac_bonus);
				} else if (method == 'desc') {
					ac = ac - parseInt(armordata.ac_bonus);
				}			
			}
		}
		
		if (method == 'asc') {
			ac = ac + parseInt(this.getAttMod('dex'));
		} else if (method == 'desc') {
			ac = ac - parseInt(this.getAttMod('dex'));
		}

		this.set('ac', ac);
	},
	
	
	selectPersonality: function(ct) {
		var personality = _.sample(appdata.personality[app.AppSettings.get('personality_type')], ct);
		this.set('personality', personality);
	},
	
	selectAppearance: function(ct) {
		var appearance =  _.sample(appdata.appearance[app.AppSettings.get('appearance_type')], ct);
		this.set('appearance', appearance);
	},
	
	selectGoal: function() {
		return  _.sample(appdata.personality.goals);
	},
	
	rollReaction: function() {
		return app.randomizer.roll(6,2);
	},
	
	//////////////////////////////////////////////////////////
	//run all the various functions to generate the npc object
	create: function() {
				
		this.rollAbilities();	
		this.selectClass();			
		this.setLevel();
		this.selectSpells();
		this.rollHp();
		this.calcAttack();
		this.selectPersonality(app.AppSettings.get('personality_count'));
		this.selectAppearance(app.AppSettings.get('appearance_count'));
		this.set('goal', this.selectGoal());
		this.set('armor', this.selectArmor());
		this.calcAC();
		this.set('reaction_roll', this.rollReaction());
		
		//gender
		this.calcGender();
		this.set( 'name', this.generateName(this.get('name_type')) );
		
		//events to update
		this.on('change:level change:charclass', function(model){ model.rollHp(); model.calcAttack(); model.selectSpells(); });
		this.on('change:occupation', function(model){ model.set('armor', model.selectArmor()); });
		this.on('change:armor', function(model){ model.calcAC(); });
		this.on('change:con', function(model){ model.rollHp(); });
		this.on('change:str change:dex', function(model){ model.calcAttack(); });
		this.on('change:dex', function(model){ model.calcAC(); });
		
		this.on('change:int change:wis change:cha', function(model){ /* nothing here, we just need to trigger change for the view to update */ });
		
	},
	

});


//!CharacterBlock View for character data
var CharacterBlock = Backbone.View.extend({
	
	tagName: 'div',
	className: 'character-block clearfix',
	
	attributes : function () {
		return {
			//id: 'character_'+this.model.get('id')
		};
	},
	
	events: {
		'click *[data-field]': 'editField',
		'click .save': 'saveCharacter',
		'click .delete': 'deleteCharacter',
		'click .remove': 'removeCharacter',
		'click .spell': 'showSpell'
	},
	
	initialize: function() {
    	this.listenTo(this.model, "change", this.render);
    	this.listenTo(this.model, "destroy", this.remove);
    	//this.listenTo(this.model, "change", this.model.save);
    },
    
    saveCharacter: function() {
		//do something
		if (this.model.isNew()) {
			this.model.save();
			app.charlist.add(this.model);
		} else {
			this.model.save();
		}
		return false;
    },
    
    deleteCharacter: function(e) {
		e.preventDefault();
		this.model.destroy();
		this.remove();
		//return false;  
    },
    
    removeCharacter: function(e) {
	    e.preventDefault();
	    //console.log(this.model.changedAttributes());
	    if (this.model.isNew()) {
		    if (!confirm('You have not saved this character. Are you sure you with to delete it?')) {
			    return false;
		    }
	    } else if (this.model.changedAttributes()) {
		    if (!confirm('You have unsaved changes that will be lost. Are you sure?')) {
			    return false;
		    }
	    }
	    this.remove();
    },
    
    showSpell: function(e) {
	    e.preventDefault();
	    var title = $(e.target).attr('data-spell');
	    if (typeof title == 'undefined') {
		    var title = $(e.target).parent().attr('data-spell');
	    }
	    var type = this.model.get('charclass');
	    spell = _.findWhere(appdata.spells[type], { title: title });
	    
	    //console.log(spell);
	    
	    var spellv = new SpellView({spell: spell});
	    //console.log(spellv);
	    $('#editmodal .modal-title').html('Spell Details: '+spell.title.capitalize());
	    $('#editmodal .modal-body').html(spellv.render().el);
		$('#editmodal').modal({});
	    
    },
    
    editField: function(e) {
	    var field = $(e.target).attr('data-field');
	    //console.log(field);
	    
	    var editv = new EditView({model: this.model, field: field});
	    
	    $('#editmodal .modal-title').html('Edit Field: '+field.capitalize());
	    $('#editmodal .modal-body').html(editv.render().el);
		$('#editmodal').modal({});
    },
    
    
    template: function(data){
    	var char_full = '<div class="row"><div class="col-xs-6"><dl class="dl-horizontal clearfix"><dt>Name</dt><dd><span data-field="name"><%= name %> (<span data-field="gender"><%= gender %></span>)</span></dd><% if(charclass == "none") { %><dt>Occupation</dt><dd><span data-field="occupation"><%= occupation %></span></dd><% } else { %><dt>Class</dt><dd><span data-field="charclass"><% var cc = charclass.capitalize() %><%= cc %>, <span data-field="level">Lvl <%= level %></span></dd><% } %></dl>';
    	char_full += '<dl class="dl-horizontal clearfix"><% _.each(ability_scores, function(v,k){ var a = v.name.capitalize(); %><dt><%= a %></dt><dd><span data-field="ability_scores.<%= v.name %>"><%= v.score %> (<% var mod = (v.modifier > 0) ? "+"+v.modifier : v.modifier; %><%= mod %>)</span></dd><% }); %></dl>';
    	
    	char_full += '<dl class="dl-horizontal clearfix"><dt>HP</dt><dd><span data-field="hp"><%= hp %></span></dd><dt>AC</dt><dd><%= ac %><% if (armor !== "") { %> (<span data-field="armor"><%= armor %></span>)<% } %></dd><dt>Attack Bonus</dt><% if (attack.melee == attack.missile) { %><dd><%= attack.melee %></dd><% } else { %><dd><%= attack.melee %> Melee</dd><dd><%= attack.missile %> Missile</dd><% } %><dt>Reaction Roll</dt><dd><%= reaction_roll %></dd></dl>';
    	
    	char_full += '</div><div class="col-xs-6">';
    	
    	char_full += '<dl class="dl-horizontal clearfix"><dt data-field="chargroup">Group</dt><dd data-field="chargroup"><%= chargroup %></span></dd></dl>';
    	
    	char_full += '<dl class="character-traits clearfix"><dt data-field="personality">Personality</dt><% _.each(personality, function(v,k){ v.capitalize(); %><dd><span data-field="personality"><%= v %></span></dd><% }); %><dt data-field="appearance">Appearance</dt><% _.each(appearance, function(v,k){ v.capitalize(); %><dd><span data-field="appearance"><%= v %></span></dd><% }); %><dt data-field="goal">Goal</dt><dd><span data-field="goal"><%= goal %></span></dd></dl>';
    	
    	char_full += '<% if (spellcaster == true) { %><section><h4 data-field="spells">Spells</h4><dl class=""><% _.each(spells, function(v,k) { %><dt data-field="spells"><%= k %></dt><% _.each(v, function(y,x) { %><dd class="spell" data-spell="<%= y %>"><%= y %> <span class="glyphicon glyphicon-info-sign"></span></dd><% }); }); %></dl></section><% } %>'; //spells
		
		char_full += '</div></div>';
		
		char_full += '<div class="pull-right hidden-print"><button title="Save" class="btn btn-default btn-xs save"><span class="glyphicon glyphicon-save"></span></button>';
		
		char_full += ' <button title="Close" class="btn btn-default btn-xs remove"><span class="glyphicon glyphicon-eye-close"></span></button>';
		
		char_full += '<% if (typeof id !== "undefined"){ %> <button title="Delete" class="btn btn-default btn-xs delete"><span class="glyphicon glyphicon-remove"></span></button><% } else { %><%} %></div>';
				
		var html = _.template(char_full, data);
		return html;
    },
    
    render: function() {
    	//something
    	//console.log('view render');
    	//console.trace();
    	this.$el.html(this.template(this.model.attributes));
    	    	
		return this;
    	
	}
	
});


//!SpellView
var SpellView = Backbone.View.extend({
	
	tagName: 'div',
	className: 'spell-details clearfix',
	
	initialize: function(options) {
		//this.options = options || {};
		this.spell = options.spell;
	},
	
	
	template: function(data) {
		//console.log('SpellView: here is template');
		var html = '';
		
		html += '<dl class="dl-horizontal">';
		
		_.each(data, function(v,k,l){
			
			html += '<dt>'+k.capitalize()+'</dt><dd>'+v+'</dd>';
			
		});
		
		html += '</dl>';
		
		return html;
	},
	
	render: function(){
		//console.log('SpellView: here is render');
		this.$el.html(this.template(this.spell));
		return this;
	}
	
});

//!View for editing the fields
var EditView = Backbone.View.extend({
	
	tagName: 'div',
	field: '',
	
	events: {
		'submit form': 'commitEdit',
		'click .randomize': 'loadRandom',
	},
	
	initialize: function(options) {
		//this.options = options || {};
		this.field = options.field;
		this.subfield = '';
		
		if (this.field.indexOf('.') !== -1 ) {
			var f = this.field.split('.');
			this.field = f[0];
			this.subfield = f[1];
		}
	},
	
	commitEdit: function(e) {
		formdata = $(e.target).serializeObject();
		//console.log(formdata);
		
		if (this.field == 'ability_scores') {
			
			var scores = _.clone( this.model.get('ability_scores') );
			//console.log(scores);
			a = _.findWhere(scores, { name: formdata.ability });
			a.score = formdata.score;
			a.modifier = this.model.calcModifier(a.name, a.score);
			var index=0;
			for (i=0;i<scores.length;i++) {
				if (scores[i].name == a.name) {
					index = i;
				}
			}
						
			scores[index] = a;
			//console.log(scores);
			this.model.set({ ability_scores: scores });
			//this.model.save({ ability_scores: scores });
			this.model.trigger('change:'+a.name, this.model);
			this.model.trigger('change', this.model);
		
		} else if (this.field == 'spells') {
			
			var fdata = { spells: formdata};
			//we have to account for a level that has only 1 spell
			_.each(fdata.spells, function (v,k,l){
				if (typeof v == 'string') {
					l[k] = [v];
				}
			});
			this.model.set(fdata);
			//this.model.save(fdata);
		} else {
			this.model.set(formdata);
			//this.model.save(formdata, {wait: true});
		}
		//this.model.save();
		$('#editmodal').modal('hide');
		
		return false;
	},
	
	loadRandom: function(e) {
		
		//console.log(e);
		var inputtarget = $(e.target).attr('data-targetfield');
		var list = $(e.target).attr('data-list');
		
		if (this.field == 'personality' || this.field == 'appearance') {
			var newval = app.randomizer.randomValue(appdata[this.field][list]);
			$('#'+inputtarget).val(newval);
		} else if (this.field == 'name') {
			
			var newval = this.model.generateName(list);
			$('#'+inputtarget).val(newval);
			
		} else if (this.field == 'spells') {
			
			//list = lvl1
			//var charclass = this.model.get('charclass');
			
			var newval = _.sample(appdata.spells.bylevel[this.model.get('charclass')][list]);
			$('#'+inputtarget).val(newval);
		} else if (this.field == 'goal') {
			var newval = _.sample(appdata.personality.goals);
			$('#'+inputtarget).val(newval);
		}
		
	},
	
	
	template: function(data){
		var field = this.field;
		var subfield = this.subfield;
		
		//console.log(this);
		var form = '<form>';
		switch (field) {
			case 'ability_scores':
				var score = this.model.getAttScore(subfield);
				form += '<input type=hidden name=ability value="'+subfield+'" />';
				form += '<div class="form-group"><label for="edit_score" class="control-label">'+subfield.capitalize()+'</label><select class="form-control" id="edit_score" name="score">';
				for(i=3;i<=18;i++) {
					var sel = (i == score) ? 'selected=selected' : '';
					form += '<option value="'+i+'" '+sel+'>'+i+'</option>';
				}
				form += '</select><div class="help-block">Updating an ability score will (if applicable) update hp, attack, spells, etc.</div></div>';
				
				break;
			
			case 'level':
				form += '<div class="form-group"><label for="level" class="control-label">Level</label><select class="form-control" id="level" name="level">';
				for(i=0;i<=9;i++) {
					var sel = (i == this.model.get(field)) ? 'selected=selected' : '';
					form += '<option value="'+i+'" '+sel+'>'+i+'</option>';
				}
				form += '<option value="random">Random</option></select><div class="help-block">Updating level will automatically update hp, spells, and attack bonus.</div></div>';
				break;
			
			case 'charclass':
				form += '<div class="form-group"><label for="charclass" class="control-label">Class</label><select class="form-control" id="charclass" name="charclass">';			
				_.each(this.model.getRules().classes, function(v,k,l) {
					var sel = (k == this.model.get(field)) ? 'selected=selected' : '';
					form += '<option value="'+k+'" '+sel+'>'+v.label+'</option>';
					
				}, this);
				form += '</select><div class="help-block">Updating class will automatically update hp, spells, and attack bonus.</div></div>';
			
				break;
			
			case 'occupation':
				form += '<div class="form-group"><label for="occupation" class="control-label">Occupation</label><select class="form-control" id="occupation" name="occupation">';
					_.each(appdata.occupations, function(v,k,l) {
						var sel = (v.name == this.model.get(field)) ? 'selected=selected' : '';
						form += '<option value="'+v.name+'" '+sel+'>'+v.name.capitalize()+'</option>';
						
					}, this)
					form += '</select><div class="help-block"></div></div>';
			
				break;
			
			case 'personality':
			case 'appearance':
				
				var cur = this.model.get(field);
				
				for(var i=0; i<cur.length; i++) {
					var num = i+1;
					form += '<div class="form-group"><label class="control-label" for="edit'+field+'_'+i+'">'+field.capitalize()+' '+num+'</label><div class="input-group"><input type=text class="form-control" id="edit'+field+'_'+i+'" name="'+field+'" value="'+cur[i]+'" />';
					
					form += '<div class="input-group-btn"><button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">Randomly Replace from... <span class="caret"></span></button><ul class="dropdown-menu pull-right">';
						_.each(appdata[field]['options'], function(v,k){
							form += '<li><a class="randomize" href="#" data-targetfield="edit'+field+'_'+i+'" data-list="'+v.option+'">'+v.label+'</a></li>';
						});			
					form += '</ul></div></div></div>';
					
				}
			
				break;
			
			case 'goal':
				
				form += '<div class="form-group"><label class="control-label" for="edit'+field+'_'+i+'">'+field.capitalize()+'</label><div class="input-group"><input type=text class="form-control" id="edit'+field+'_'+i+'" name="'+field+'" value="<%= '+field+' %>" />';
					
					form += '<div class="input-group-btn"><button type="button" class="btn btn-default randomize" data-targetfield="edit'+field+'_'+i+'" data-list="goals">Randomly Replace</button></div></div></div>';
				
				break;
				
			case 'gender':
			
				form += '<div class="form-group">';
				var sel = ('male' == this.model.get(field)) ? 'checked=checked' : '';
				form += '<label class="radio-inline"><input type="radio" name="gender" id="gender1" value="male" '+sel+' /> Male</label>';
				var sel = ('female' == this.model.get(field)) ? 'checked=checked' : '';
				form += '<label class="radio-inline"><input type="radio" name="gender" id="gender2" value="female" '+sel+' /> Female</label>';
				form += '<div class="help-block">The gender the character identifies as. It is only used for random name generation.</div></div>';
				
				break;
			case 'name':
				form += '<div class="form-group"><label class="control-label" for="edit'+field+'">'+field.capitalize()+'</label><div class="input-group"><input type=text class="form-control" id="edit'+field+'" name="'+field+'" value="<%= '+field+' %>" />';
				
				form += '<div class="input-group-btn"><button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">Randomly Generate <span class="caret"></span></button><ul class="dropdown-menu pull-right">';
						_.each(appdata[field]['options'], function(v,k){
							form += '<li><a class="randomize" href="#" data-targetfield="edit'+field+'" data-list="'+v.option+'">'+v.label+'</a></li>';
						});			
					form += '</ul></div></div>';
				
				form += '<span class="help-block">If you wish to generate a new random name, select one of the options below.</span></div>';
								
				break;
			
			case 'spells':
				var spells = this.model.get('spells');
				
				_.each(spells, function(v,k,l){
					var level = k.split(' ')[1];
					
					form += '<fieldset><legend>'+k+'</legend>';
					
					_.each(v, function(y,x) {
						var ct = x+1;
						form += '<div class="form-group"><label class="control-label" for="edit'+field+'_'+level+'_'+x+'">'+ct+'</label><div class="input-group"><input type=text class="form-control" id="edit'+field+'_'+level+'_'+x+'" name="'+k+'" value="'+y+'" />';
				
						form += '<div class="input-group-btn"><button type="button" class="btn btn-default randomize" data-targetfield="edit'+field+'_'+level+'_'+x+'" data-list="lvl'+level+'">Randomly Generate</button></div></div></div>';
						
					});
					
					form += '</fieldset>';
					
				});
				
			
				break;
				
			case 'armor':
								
				form += '<div class="form-group"><label for="armor" class="control-label">Armor</label><select class="form-control" id="armor" name="armor">';
					_.each(this.model.getRules().armor, function(v,k,l) {
						var sel = (v.name == this.model.get(field)) ? 'selected=selected' : '';
						form += '<option value="'+v.name+'" '+sel+'>'+v.name.capitalize()+'</option>';
						
					}, this)
				form += '</select><div class="help-block"></div></div>';
			
				break;
			
			default:
				form += '<div class="form-group"><label class="control-label" for="edit'+field+'">'+field+'</label><input type=text class="form-control" id="edit'+field+'" name="'+field+'" value="<%= '+field+' %>" /><span class="help-block"></span></div>';
				break;

		}
		
		form += '<div class="form-group"><button type=submit class="btn btn-primary">Update</button></div></form>';

		var html = _.template(form, data);
		return html;
	},
	
	render: function() {
    	this.$el.html(this.template(this.model.attributes));
		return this;	
	}
	
});



//!CharCollection
var CharCollection = Backbone.Collection.extend({

    model: Character,
	localStorage: new Backbone.LocalStorage("osr-random-generator-npcs"), // Unique name within your app.
	
	comparator: function(char) {
      return [char.get("group"), char.get("name")]
    },
	
	initialize: function(){
		//this.listenTo(this.model, 'sync', this.addChar);
	},
	
	
	/*
addChar: function(m,r,opt) {
		this.add(m);
	},
*/


});


//!CharList
//view for list of characters
var CharList = Backbone.View.extend({
	
	model: CharCollection,
	
	tagName:'section',
	className: '',
 
    initialize:function () {
        this.listenTo(this.model, "add", this.render);
        this.listenTo(this.model, "destroy", this.render);
        this.listenTo(this.model, "change:chargroup", this.render);
    },
     
    render: function () {
    	$(this.el).html('<h1>Saved Characters</h1>');

    	var ord = this.model.groupBy(function(char){
    		return char.get('chargroup');
    	});
    	k = _.keys(ord).sort(); //sort by group name
    	_.each(k, function(group) {
    		var grouplabel = (group == '') ? '[no group]' : group;
    	 	$(this.el).append('<h2>'+grouplabel+'</h2>');
    	 		var $glist = $('<ul class="list-unstyled"></ul>');
		 		_.each(ord[group], function(char){
        			$glist.append(new CharacterListItem({model:char}).render().el);
        		}, this);
        		$(this.el).append($glist);
        }, this);

        return this;
    }
	
	
});


//!CharacterListItem
//View for character data in brief list
var CharacterListItem = Backbone.View.extend({
	
	tagName: 'li',
	className: 'character-list clearfix',
	
	attributes : function () {
		return {
			//id: 'character_'+this.model.get('id')
		};
	},
	
	events: {
		'click .view': 'viewCharacter',
		'click .delete': 'deleteCharacter'
	},
	
	initialize: function() {
    	this.listenTo(this.model, "change", this.render);
    },

    viewCharacter: function(e) {
		e.preventDefault();
		$('#characters-new').append(new CharacterBlock({model:this.model}).render().el)
	},
    
    deleteCharacter: function(e) {
		e.preventDefault();
		if (!confirm('Are you sure you want to delete this character?')) { return; }
		this.model.destroy();
    },
    
    template: function(data){
    	var char_list = '';
    	
 		char_list += '<div class="pull-right"><button title="View" class="btn btn-default btn-xs view"><span class="glyphicon glyphicon-eye-open"></span></button>';
		
		char_list += '<% if (typeof id !== "undefined"){ %> <button title="Delete" class="btn btn-default btn-xs delete"><span class="glyphicon glyphicon-remove"></span></button><% } else { %><%} %></div>';
		
		char_list += '<%= name %> <% if(charclass == "none") { %>(<%= occupation %>)<% } else { %>(<% var cc = charclass.capitalize() %><%= cc %> <%= level %>)<% } %>';
				
		var html = _.template(char_list, data);
		return html;
    },
    
    render: function() {
    	this.$el.html(this.template(this.model.attributes));
		return this;
	}
	
});


//!CharForm character creation form
var CharForm = Backbone.View.extend({
 
	tagName: 'form',
	id: 'npc-form',
	
    events:{
        "submit": "newChar",
        "change #chargroup": "addGroup"
    },
 
    initialize:function () {
        this.render();
        this.listenTo(this.model, 'change', this.render);
    },
    
/*
    rerender: function() {
	    formdata = $(e.target).serializeObject();
	    this.render(formdata);
    }
*/
    
    render: function () {
    	var rules = appdata.rules[this.model.get('rules_set')];
    	var form = '<div class="row"><div class="form-group col-sm-9"><label for="charclass" class="control-label">Class</label><select class="form-control" id="charclass" name="charclass">';
    		_.each(rules.classes, function(v,k,l) {
				form += '<option value="'+k+'">'+v.label+'</option>';		
			}, this);
    	form += '</select><div class="help-block"></div></div>';
		form += '<div class="form-group col-sm-3"><label for="level" class="control-label">Level</label><select class="form-control" id="level" name="level">';
			for(var i=0; i<10; i++) {
				form += '<option value="'+i+'">'+i+'</option>';
			}
		form += '<option value="random">Random</option></select><div class="help-block"></div></div></div>';
    	
    	form += '<div class="row">';
	    	form += '<div class="form-group col-sm-6"><label for="name_type" class="control-label">Name Type</label><select class="form-control" id="name_type" name="name_type">';
	    		_.each(appdata.name.options, function(v){
		    		form += '<option value="'+v.option+'">'+v.label+'</option>';
	    		});
			form += '</select><div class="help-block"></div></div>';
			
			//form += '<div class="form-group col-sm-6"><label for="chargroup" class="control-label">Character Group</label><input type=text class="form-control" name="chargroup" id="chargroup" value="" /><div class="help-block">For organizing your saved NPCs.</div></div>';
			form += '<div class="form-group col-sm-6"><label for="chargroup" class="control-label">Character Group</label><select class="form-control" name="chargroup" id="chargroup">';
				form += '<option value="">---</option>';
				_.each(this.model.get('chargroup'), function(v,k) {
					form += '<option value="'+v.name+'">'+v.name+'</option>';
				}, this);
				form += '<option value="0">Add New Group</option>';
			form += '</select><div class="help-block">For organizing your saved NPCs.</div></div>';
    	form += '</div>';
    	
    	form += '<div class="form-group"><button type=submit class="btn btn-primary">Generate NPC</button></div>';
    	
    	$(this.el).html(form);
        return this;
    },
 
    newChar:function (e) {
    	e.preventDefault();
    	formdata = $(e.target).serializeObject();
    	var char = new Character(formdata);
    	char.create();
    	$('#characters-new').append(new CharacterBlock({model:char}).render().el);
    },
    
    addGroup: function(e) {
	    var val = $(e.target).val();
	    if (val == '0') {
		    console.log('new group modal');
		    
		    var form = ''; 
		    
		    $('#editmodal .modal-title').html('Add Character Group');
			$('#editmodal .modal-body').html(new CharGroupView({model:this.model}).render().el);			
			$('#editmodal').modal({});
			$('#editmodal').on('shown.bs.modal', function(e) {
				$(e.target).find('input[type="text"]:first').focus();
			});
		    $(e.target).val('');
	    }
    }
    
});


//!CharGroup
var CharGroupView = Backbone.View.extend({
	
	tagName: 'form',
	className: 'chargroup-add clearfix',
	
	initialize: function(options) {
		//this.options = options || {};
	},
	
	events: {
        "submit": "newGroup"
    },
	
	template: function(data) {
		//console.log('CharGroupView: here is template');
		var html = '';
		
		html += '<div class="form-group"><label for="newgroup" class="control-label">New Character Group</label><input type="text" class="form-control" id="newgroup" name="newgroup" value="" /></div><div class="form-group"><button type=submit class="btn btn-primary">Add</button></div>';

		
		return html;
	},
	
	render: function(){
		//console.log('CharGroupView: here is render');
		this.$el.html(this.template());
		return this;
	},
	
	newGroup: function(e) {
		e.preventDefault();
    	var formdata = $(e.target).serializeObject();
    	if (formdata.newgroup !== '') {
    		var groups = _.clone( this.model.get('chargroup') );
	    	if (typeof _.findWhere(groups, { name: formdata.newgroup }) == 'undefined') {
		    	groups.push({ name: formdata.newgroup });
		    	//save groups, avoid rerendering and just add the new group and select it
		    	//this keeps the form values that are already set
		    	this.model.save( { 'chargroup': groups }, { silent: true });
		    	$('#chargroup').append(jQuery('<option></option>').attr('value', formdata.newgroup).text(formdata.newgroup));
		    	$('#chargroup').val(formdata.newgroup);
	    	} else {
		    	alert("That group already exists!");
		    	return false;
	    	}
	    	$('#editmodal').modal('hide');
	    	
    	}
	}
	
});
