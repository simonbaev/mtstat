/* jshint esnext: true */

/*
	Parse globally defined mtData object to extract array of IDs
*/
function getIDs() {
	var divisionIndex, schoolIndex, studentIndex;
	var IDs = [];
	var pad = function(number) {
		if (number < 10) {
			return "0" + number;
		}
		else if (number > 99) {
			return "##";
		}
		return "" + number;
	};
	for (divisionIndex = 0; divisionIndex < Object.keys(mtData.teams).length; divisionIndex++) {
		var division = mtData.teams[Object.keys(mtData.teams)[divisionIndex]];
		for (schoolIndex = 0; schoolIndex < division.schools.length; schoolIndex++) {
			var school = division.schools[schoolIndex];
			for (studentIndex = 0; studentIndex < school.students.length; studentIndex++) {
				IDs.push("" + (divisionIndex + 1) + pad(schoolIndex + 1) + (studentIndex + 1));
			}
		}
	}
	return IDs;
}
/*
	Parse ID to get division, school, and student name
*/
function parseID(ID) {
	let divisionIndex = parseInt(ID.substring(0,1)) - 1;
	let schoolIndex = parseInt(ID.substring(1,3)) - 1;
	let studentIndex = parseInt(ID.substring(3,4)) - 1;
	if(divisionIndex === -1 || schoolIndex === -1 || studentIndex === -1) {
		return null;
	}
	try {
		return {
			division: mtData.teams[divisionIndex].division,
			school: mtData.teams[divisionIndex].schools[schoolIndex].name,
			name: mtData.teams[divisionIndex].schools[schoolIndex].students[studentIndex]
		};
	}
	catch (e) {
		console.error("Error: cannot parse ID: " + ID + "(" + e.message + ")");
		return null;
	}
}
/*
	Parse ID and print the parsed object as CSV string
*/
function idToString(id) {
	var student = parseID(id);
	return id + "," + student.name + "," + student.school;
}
/*
	Parse questions to index them with respect to question number
*/
function getQAs() {
	let QAs = [];
	let categories = Object.keys(mtData.questions);
	for(let category of categories) {
		for(let question in mtData.questions[category]) {
			QAs[parseInt(question) - 1] = {
				category: category,
				number: question,
				answer: mtData.questions[category][question],
				counters: {
					1: 0,
					2: 0,
					3: 0,
					4: 0,
					5: 0,
					0: 0,
					correct: 0
				}
			};
		}
	}
	return QAs;
}
/*
	Evaluate scantron data
*/
function evalAnswers(IDs) {
	let QAs = getQAs();
	let countersTemplate = {
		correct: {
			Total: 0
		},
		incorrect: 0
	};
	let categories = Object.keys(mtData.questions);
	for(let category of categories) {
		countersTemplate.correct[category] = 0;
	}
	results = {
		divisions: {},
		stats: {
			IDs: {}
		},
	};
	for(let ID of IDs) {
		results.stats.IDs[ID] = 0;
	}
	//-- Work through all scantron sheets to populate results object
	for(let line of mtData.scanData) {
		let id = line.substring(0,4);
		let student = parseID(id);
		if(!student) {
			continue;
		}
		results.stats.IDs[id]++;
		let answers = line.substring(4).split("");
		let counters = JSON.parse(JSON.stringify(countersTemplate));
		for(let QA of QAs) {
			QA.counters[parseInt(answers[QA.number-1])]++;
			if(answers[QA.number-1] === "0") {
				continue;
			}
			else if(parseInt(answers[QA.number-1]) === QA.answer) {
				counters.correct.Total++;
				counters.correct[QA.category]++;
				QA.counters.correct++;
			}
			else {
				counters.incorrect++;
			}
		}
		if(!results.divisions[student.division]) {
			results.divisions[student.division] = {
				division: student.division,
				schools: {},
				stats: {}
			};
		}
		if(!results.divisions[student.division].schools[student.school]) {
			results.divisions[student.division].schools[student.school] = {
				school: student.school,
				division: student.division,
				stats: {},
				students: {}
			};
		}
		results.divisions[student.division].schools[student.school].students[student.name] = {
			id: id,
			counters: counters,
			score: 4 * counters.correct.Total - counters.incorrect + 40,
		};
	}
	//-- Calculate per-school, per-division, and per-tournament stats
	let statTournament = results.stats;
	statTournament.averages = {};
	statTournament.numberOfStudents = 0;
	let individualScores = [];
	for(let category of categories) {
		statTournament.averages[category] = 0;
	}
	for(let division in results.divisions) {
		let schools = results.divisions[division].schools;
		let statDivision = results.divisions[division].stats;
		//-- initialize averages per division per category
		statDivision.questions = {
			averages: {}
		};
		statDivision.schools = {
			ranking: []
		};
		statDivision.students = {
			ranking: [],
			average: 0,
			deviation: 0
		};
		for(let category of categories) {
			statDivision.questions.averages[category] = 0;
		}
		for(let school in schools) {
			let students = schools[school].students;
			let statSchool = schools[school].stats;
			let top4 = [];
			statSchool.averages = {};
			for(let category of categories) {
				statSchool.averages[category] = 0;
			}
			for(let student in students) {
				students[student].name = student;
				top4.push(students[student]);
				statDivision.students.average += students[student].score;
				statDivision.students.ranking.push({
					name: students[student].name,
					score: students[student].score,
					school: school,
				});
				individualScores.push(students[student].score);
				for(let category of categories) {
					let temp = students[student].counters.correct[category] / Object.keys(mtData.questions[category]).length;
					statSchool.averages[category] += temp;
					statTournament.averages[category] += temp;
				}
			}
			statTournament.numberOfStudents += Object.keys(students).length;
			for(let category of categories) {
				statSchool.averages[category] /= Object.keys(students).length / 100;
				statDivision.questions.averages[category] += statSchool.averages[category];
			}
			top4.sort(function(a,b){
				return (b.score - a.score);
			});
			statSchool.top4total = 0;
			statSchool.top4list = [];
			for(let student of top4.slice(0,4)) {
				statSchool.top4total += student.score;
				statSchool.top4list.push({
					name: student.name,
					score: student.score
				});
			}
			statDivision.schools.ranking.push({
				name: school,
				top4total: statSchool.top4total
			});
		}
		//-- Normalize per-student average per division
		statDivision.students.average /= statDivision.students.ranking.length;
		//-- Standard deviation of students' scores per division
		for(let student of statDivision.students.ranking) {
			statDivision.students.deviation += Math.pow((student.score - statDivision.students.average), 2);
		}
		statDivision.students.deviation = Math.sqrt(statDivision.students.deviation / statDivision.students.ranking.length);
		//-- Sort schools in division with respect to top4 total score
		statDivision.schools.ranking.sort(function(a,b){
			return (b.top4total - a.top4total);
		});
		//-- Sort students in division with respect to personal score
		statDivision.students.ranking.sort(function(a,b){
			return (b.score - a.score);
		});
		//-- Normalize average per division and accumulate average per tournament
		for(let category of categories) {
			statDivision.questions.averages[category] /= Object.keys(schools).length;
		}
	}
	statTournament.questionsCounts = {
		Total: 0
	};
	for(let category of categories) {
		let temp = Object.keys(mtData.questions[category]).length;
		statTournament.averages[category] /= statTournament.numberOfStudents / 100;
		statTournament.questionsCounts[category] = temp;
		statTournament.questionsCounts.Total += temp;
	}

	for(let QA of QAs) {
		QA.counters.correct /= statTournament.numberOfStudents / 100;
	}
	statTournament.QAs = QAs;
	//-- Tournament-wide score statistics
	statTournament.individualScores = {};
	statTournament.individualScores.average = individualScores.reduce(function(accumulator, current){
		return accumulator + current;
	},0) / individualScores.length;
	statTournament.individualScores.deviation = Math.sqrt(
		individualScores
		.map(function(current){
			let temp = current - statTournament.individualScores.average;
			return temp * temp;
		})
		.reduce(function(accumulator, current){
			return accumulator + current;
		},0) / (individualScores.length)
	);
	return results;
}
/*
	Compile Tournament report
*/
function tournamentReport(allData, container) {
	container
	.empty()
	.append(
		$('<div>')
		.append(
			$('<div>')
			.addClass('tournament-info flex-column flex-center')
			.append(
				$('<h3>')
				.html('Tournamernt wide statistics')
			)
		)
		.append(
			$('<fieldset>')
			.append(
				$('<legend>')
				.text('Summary')
			)
			.append(
				$('<div>')
				.addClass('row')
				.append(
					$('<div>')
					.addClass('col-xs-10')
					.append(
						$('<p>')
						.html(
							'The average of <b>' + allData.stats.numberOfStudents + '</b> scores = <b>' + allData.stats.individualScores.average.toFixed(2) + '</b>, the standard deviation = <b>' + allData.stats.individualScores.deviation.toFixed(2) + '</b>'
						)
					)
				)
				.append(
					$('<label>')
					.addClass('col-xs-2')
					.append(
						$('<button>')
						.attr('type','button')
						.addClass('btn btn-default pull-right hidden-print')
						.append(
							$('<span>')
							.addClass('glyphicon glyphicon-print')
						)
						.click(function(){
							window.print();
						})
					)
				)
			)
		)
		.append(
			$('<fieldset>')
			.append(
				$('<legend>')
				.text('Items analysis')
			)
			.append(
				$('<table>')
				.addClass('table items-analysis')
				.append(
					$('<thead>')
					.append(
						$('<tr>')
						.append(
							$('<th>')
							.text('Question')
						)
						.append(
							$('<th>')
							.text('Blanks')
						)
						.append(
							$('<th>').html('1<sup>st</sup>')
						)
						.append(
							$('<th>').html('2<sup>nd</sup>')
						)
						.append(
							$('<th>').html('3<sup>rd</sup>')
						)
						.append(
							$('<th>').html('4<sup>th</sup>')
						)
						.append(
							$('<th>').html('5<sup>th</sup>')
						)
						.append(
							$('<th>').text('Category')
						)
						.append(
							$('<th>').text('Percent')
						)
					)
				)
				.append(
					$('<tbody>')
				)
			)
		)
	);
	for(let questionIndex=0; questionIndex<allData.stats.QAs.length; questionIndex++) {
		let question = allData.stats.QAs[questionIndex];
		container
		.find('table.items-analysis tbody')
		.append(
			$('<tr>')
			.append(
				$('<th>').text(questionIndex + 1)
			)
			.append(
				$('<td>').text(question.counters[0])
			)
			.append(
				$('<td>').text(question.counters[1]).addClass(question.answer === 1 ? 'correct-answer' : '')
			)
			.append(
				$('<td>').text(question.counters[2]).addClass(question.answer === 2 ? 'correct-answer' : '')
			)
			.append(
				$('<td>').text(question.counters[3]).addClass(question.answer === 3 ? 'correct-answer' : '')
			)
			.append(
				$('<td>').text(question.counters[4]).addClass(question.answer === 4 ? 'correct-answer' : '')
			)
			.append(
				$('<td>').text(question.counters[5]).addClass(question.answer === 5 ? 'correct-answer' : '')
			)
			.append(
				$('<td>').text(question.category)
			)
			.append(
				$('<td>').text(question.counters.correct.toFixed(2))
			)
		);
	}
}
/*
	Compile Division report
*/
function divisionReport(allData, divisionObj, container) {
	if(!divisionObj) {
		return;
	}
	container
	.append(
		$('<div>')
		.append(
			$('<div>')
			.addClass('division-info flex-column flex-center')
			.append(
				$('<h3>')
				.text('\'' + divisionObj.division + '\' division')
			)
		)
		.append(
			$('<fieldset>')
			.append(
				$('<legend>')
				.text('Schools ranking')
			)
			.append(
				$('<table>')
				.addClass('table schools-ranking')
				.append(
					$('<thead>')
					.append(
						$('<tr>')
						.append(
							$('<th>')
							.text('Rank')
						)
						.append(
							$('<th>')
							.text('School name')
						)
						.append(
							$('<th>')
						)
						.append(
							$('<th>')
							.text('Top4 score')
						)
					)
				)
				.append(
					$('<tbody>')
				)
			)
		)
		.append(
			$('<fieldset>')
			.append(
				$('<legend>')
				.text('Students ranking (avg: ' + divisionObj.stats.students.average.toFixed(2) + ', std: ' + divisionObj.stats.students.deviation.toFixed(2) + ')')
			)
			.append(
				$('<table>')
				.addClass('table students-ranking')
				.append(
					$('<thead>')
					.append(
						$('<tr>')
						.append(
							$('<th>')
							.text('Rank')
						)
						.append(
							$('<th>')
							.text('Student name')
						)
						.append(
							$('<th>')
							.text('School name')
						)
						.append(
							$('<th>')
							.text('Score')
						)
					)
				)
				.append(
					$('<tbody>')
				)
			)
		)
	);
	for(let schoolIndex=0; schoolIndex<divisionObj.stats.schools.ranking.length; schoolIndex++) {
		let school = divisionObj.stats.schools.ranking[schoolIndex];
		container.find('table.schools-ranking:last tbody')
		.append(
			$('<tr>')
			.append(
				$('<th>')
				.text(schoolIndex + 1)
			)
			.append(
				$('<td>')
				.attr('colspan','2')
				.text(school.name)
			)
			.append(
				$('<td>')
				.text(school.top4total)
			)
		);
	}
	for(let studentIndex=0; studentIndex<divisionObj.stats.students.ranking.length; studentIndex++) {
		let student = divisionObj.stats.students.ranking[studentIndex];
		container.find('table.students-ranking:last tbody')
		.append(
			$('<tr>')
			.append(
				$('<th>')
				.text(studentIndex + 1)
			)
			.append(
				$('<td>')
				.text(student.name)
			)
			.append(
				$('<td>')
				.text(student.school)
			)
			.append(
				$('<td>')
				.text(student.score)
			)
		);
	}
}
/*
	Compile school report
*/
function schoolReport(allData, schoolObj, container) {
	if(!schoolObj)	{
		return;
	}
	container
	.append(
		$('<div>')
		.append(
			$('<div>')
			.addClass('school-info flex-column flex-center')
			.append(
				$('<h3>')
				.text(schoolObj.school + ' (' + schoolObj.division + ')')
			)
		)
		.append(
			$('<p>')
			.addClass('text-justify')
			.html(
				'The <strong>Score</strong> is computed using the formula <strong>4C - I + 40</strong>, where <strong>C</strong> represents the number of correct responses and <strong>I</strong> represents the number of incorrect responses. Incomplete erasures and multiple marks are scored as incorrect responses.  Blank responses do not affect the score.  The table below shows only the score and the number correct. If you desire the number incorrect and the number left blank, you will have to deduce them from the scoring formula.'
			)
		)
		.append(
			$('<p>')
			.addClass('text-justify')
			.html(
				'We enjoyed having you as part of our activities today and hope that you found this to be a rewarding learning experience.  We look forward to seeing you at Georgia Southwestern at our other competitions and visitations during the year.'
			)
		)
		.append(
			$('<fieldset>')
			.append(
				$('<legend>')
				.text('School\'s statistics per question category, %')
			)
			.append(
				$('<table>')
				.addClass('table stats-averages')
				.append(
					$('<thead>')
					.append(
						$('<tr>')
						.addClass('categories')
						.append(
							$('<th>')
							.text('')
						)
						.append(
							$('<th>')
							.text('')
						)
					)
				)
				.append(
					$('<tbody>')
					.append(
						$('<tr>')
						.addClass('stats-averages-school')
						.append(
							$('<th>')
							.text('School')
							.attr('colspan','2')
						)
					)
					.append(
						$('<tr>')
						.addClass('stats-averages-division')
						.append(
							$('<th>')
							.text('Division')
							.attr('colspan','2')
						)
					)
					.append(
						$('<tr>')
						.addClass('stats-averages-tournament')
						.append(
							$('<th>')
							.text('Tournament')
							.attr('colspan','2')
						)
					)
				)
			)
		)
		.append(
			$('<fieldset>')
			.append(
				$('<legend>')
				.text('Students\' statistics per question category (# of correct answers / # of questions)')
			)
			.append(
				$('<table>')
				.addClass('table stats-individual')
				.append(
					$('<thead>')
					.append(
						$('<tr>')
						.append(
							$('<th>')
							.text('Student Name')
						)
						.append(
							$('<th>')
							.text('Score')
						)
					)
				)
				.append(
					$('<tbody>')
				)
			)
		)
		.append(
			$('<fieldset>')
			.append(
				$('<legend>')
				.text('Top 4 score: ' + schoolObj.stats.top4total)
			)
		)
		.append(
			$('<fieldset>')
			.append(
				$('<legend>')
				.text('Ciphering total: ')
			)
		)
		.append(
			$('<fieldset>')
			.append(
				$('<legend>')
				.text('Match total: ')
			)
		)
	);
	let categories = Object.keys(schoolObj.stats.averages);
	categories.sort().forEach(function(category){
		container
		.find('table.stats-averages:last thead tr.categories')
		.append(
			$('<th>')
			.text(category)
		);
	});
	container.find('table.stats-averages:last thead tr.categories').append($('<th>'));
	categories.forEach(function(category){
		container
		.find('table.stats-averages:last tbody tr.stats-averages-school')
		.append(
			$('<td>')
			.text(schoolObj.stats.averages[category].toFixed(2))
		);
	});
	categories.forEach(function(category){
		container
		.find('table.stats-averages:last tbody tr.stats-averages-division')
		.append(
			$('<td>')
			.text(allData.divisions[schoolObj.division].stats.questions.averages[category].toFixed(2))
		);
	});
	categories.forEach(function(category){
		container
		.find('table.stats-averages:last tbody tr.stats-averages-tournament')
		.append(
			$('<td>')
			.text(allData.stats.averages[category].toFixed(2))
		);
	});
	Object.keys(schoolObj.students[Object.keys(schoolObj.students)[0]].counters.correct).sort().forEach(function(category){
		container
		.find('table.stats-individual:last thead tr')
		.append(
			$('<th>')
			.text(category)
		);
	});
	Object.keys(schoolObj.students).sort().forEach(function(studentName){
		let studentObj = schoolObj.students[studentName];
		container
		.find('table.stats-individual:last tbody')
		.append(
			$('<tr>')
			.append(
				$('<td>')
				.text(studentName)
			)
			.append(
				$('<td>')
				.text(studentObj.score)
			)
		);
		container.find('table.stats-individual:last thead tr th:gt(1)').each(function(index){
			let th = $(this);
			container
			.find('table.stats-individual:last tbody tr')
			.last()
			.append(
				$('<td>')
				.text(studentObj.counters.correct[th.text()] + '/' + allData.stats.questionsCounts[th.text()])
			);
		});
	});
}
/*
	Compile student report
*/
function studentReport(allData, studentObj, container) {
	container
	.empty()
	.append(
		$('<div>')
		.append(
			$('<div>')
			.addClass('student-info flex-column flex-center')
			.append(
				$('<h3>')
				.text('Individual report for ' + studentObj.name)
			)
		)
	);
}
/*
	Compile log report
*/
function logReport(allData, container) {
	container
	.append(
		$('<fieldset>')
		.addClass('duplicates')
		.hide()
		.append(
			$('<legend>')
			.text('Duplicated IDs in scantron data ')
			.append($('<span>'))
		)
		.append(
			$('<table>')
			.addClass('table')
			.append(
				$('<thead>')
				.append(
					$('<tr>')
					.append($('<th>').text('ID'))
					.append($('<th>').text('Name'))
					.append($('<th>').text('School'))
					.append($('<th>').text('Division'))
				)
			)
			.append(
				$('<tbody>')
			)
		)
	)
	.append(
		$('<fieldset>')
		.addClass('no-show')
		.hide()
		.append(
			$('<legend>')
			.text('No-show records ')
			.append($('<span>'))
		)
		.append(
			$('<table>')
			.addClass('table')
			.append(
				$('<thead>')
				.append(
					$('<tr>')
					.append($('<th>').text('ID'))
					.append($('<th>').text('Name'))
					.append($('<th>').text('School'))
					.append($('<th>').text('Division'))
				)
			)
			.append(
				$('<tbody>')
			)
		)
	);
	let cntNoShow = 0, cntDuplicates = 0;
	for(let ID of Object.keys(allData.stats.IDs)) {
		let target = null;
		if(allData.stats.IDs[ID] === 0) {
			target = $('.no-show table tbody');
			cntNoShow++;
		}
		else if(allData.stats.IDs[ID] > 1) {
			target = $('.duplicates table tbody');
			cntDuplicates++;
		}
		let student = parseID(ID);
		if(target) {
			target
			.append(
				$('<tr>')
				.append($('<td>').text(ID))
				.append($('<td>').text(student.name))
				.append($('<td>').text(student.school))
				.append($('<td>').text(student.division))
			);
		}
	}
	if(cntNoShow > 0) {
		$('.no-show').show().find('legend span').text('(' + cntNoShow + ')');
	}
	if(cntDuplicates > 0) {
		$('.duplicates').show().find('legend span').text('(' + cntDuplicates + ')');
	}
}
/*
	Document ready function
*/
$(document).ready(function() {
	//-- Use YEAR from mtData object (defined in data.js)
	var year = mtData.date.split(/\//)[2];
	document.title = "GSW Math Tournament " + year;
	$('.title > h3 > span').text(year);
	//-- Process date from mtData object
	var IDs = getIDs();
	var labels = IDs.map(function(id) {
		return idToString(id);
	});
	var evaluatedData = evalAnswers(IDs);
	console.log(evaluatedData);
	//-- Commons
	$('button.print').click(function(){
		window.print();
	});
	let divisions = Object.keys(evaluatedData.divisions).sort();
	//-- Tournament report
	tournamentReport(evaluatedData, $('#tournament .results-container'));
	//-- Log tab
	logReport(evaluatedData, $('#log .container').empty());
	//-- Division tab
	divisions.forEach(function(division){
		$('#division-division')
		.append(
			$('<option>')
			.attr({
				'value': division
			})
			.text(division)
		);
	});
	$('#division-division')
	.change(function(){
		let division = $('#division-division').find('option:selected').val();
		let divisionObj = evaluatedData.divisions[division];
		divisionReport(evaluatedData, divisionObj, $('#division .results-container').empty());
	})
	.find('option:eq(0)')
	.attr('selected','')
	.end()
	.trigger('change');
	//-- School tab
	divisions.forEach(function(division){
		$('#school-division')
		.append(
			$('<option>')
			.attr({
				'value': division
			})
			.text(division)
		);
	});
	$('#school-division')
	.change(function(){
		let division = $('#school-division').find('option:selected').val();
		if(!division) {
			return false;
		}
		let schools = Object.keys(evaluatedData.divisions[division].schools).sort();
		$('#school-school').empty();
		schools.forEach(function(school){
			$('#school-school')
			.append(
				$('<option>')
				.attr({
					'value': school
				})
				.text(school)
			);
		});
		$('#school-school')
		.change(function(){
			let schoolName = $('#school-school').find('option:selected').val();
			let division = $('#school-division').find('option:selected').val();
			let schoolObj = evaluatedData.divisions[division].schools[schoolName];
			schoolReport(evaluatedData, schoolObj, $('#school .results-container').empty());
		})
		.find('option:eq(0)')
		.attr('selected','')
		.end()
		.trigger('change');
	})
	.find('option:eq(0)')
	.attr('selected','')
	.end()
	.trigger('change');
	//-- Bulk print
	$('#bulk .print-schools').click(function(){
		$('#bulk .visible-print-block').empty();
		for(let division of Object.keys(evaluatedData.divisions).sort()) {
			for(let school of Object.keys(evaluatedData.divisions[division].schools).sort()) {
				let schoolObj = evaluatedData.divisions[division].schools[school];
				schoolReport(evaluatedData, schoolObj, $('#bulk .bulk-schools'));
			}
		}
		window.print();
	});
	$('#bulk .print-divisions').click(function(){
		$('#bulk .visible-print-block').empty();
		for(let division of Object.keys(evaluatedData.divisions).sort()) {
			let divisionObj = evaluatedData.divisions[division];
			divisionReport(evaluatedData, divisionObj, $('#bulk .bulk-divisions'));
		}
		window.print();
	});
	$('#bulk .save-labels').click(function(){
		$(this)
		.attr({
			'href': 'data:application/csv;charset=UTF-8,' + encodeURIComponent(labels.join('\n')),
			'download': 'labels.csv'
		});
	});
});
