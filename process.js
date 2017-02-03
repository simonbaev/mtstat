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
	for (divisionIndex = 0; divisionIndex < mtData.teams.length; divisionIndex++) {
		var division = mtData.teams[divisionIndex];
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
	var temp = parseID(id);
	return id + "," + temp.student + "," + temp.school;
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
function evalAnswers() {
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
		stats: {}
	};
	//-- Work through all scantron sheets to populate results object
	for(let line of mtData.scanData) {
		let id = line.substring(0,4);
		let student = parseID(id);
		if(!student) {
			continue;
		}
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
	Compile school report
*/
function schoolReport(allData, schoolObj, container) {
	//-- Markup preparation
	container
	.empty()
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
						)
					)
					.append(
						$('<tr>')
						.addClass('stats-averages-division')
						.append(
							$('<th>')
							.text('Division')
						)
					)
					.append(
						$('<tr>')
						.addClass('stats-averages-tournament')
						.append(
							$('<th>')
							.text('Tournament')
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
		.find('table.stats-averages thead tr.categories')
		.append(
			$('<th>')
			.text(category)
		);
	});
	container.find('table.stats-averages thead tr.categories').append($('<th>'));
	categories.forEach(function(category){
		container
		.find('table.stats-averages tbody tr.stats-averages-school')
		.append(
			$('<td>')
			.text(schoolObj.stats.averages[category].toFixed(2))
		);
	});
	categories.forEach(function(category){
		container
		.find('table.stats-averages tbody tr.stats-averages-division')
		.append(
			$('<td>')
			.text(allData.divisions[schoolObj.division].stats.questions.averages[category].toFixed(2))
		);
	});
	categories.forEach(function(category){
		container
		.find('table.stats-averages tbody tr.stats-averages-tournament')
		.append(
			$('<td>')
			.text(allData.stats.averages[category].toFixed(2))
		);
	});
	Object.keys(schoolObj.students[Object.keys(schoolObj.students)[0]].counters.correct).sort().forEach(function(category){
		container
		.find('table.stats-individual thead tr')
		.append(
			$('<th>')
			.text(category)
		);
	});
	Object.keys(schoolObj.students).sort().forEach(function(studentName){
		let studentObj = schoolObj.students[studentName];
		container.find('table.stats-individual tbody').append($('<tr>').append($('<td>').text(studentName)));
		container.find('table.stats-individual thead tr th:gt(0)').each(function(index){
			let th = $(this);
			container
			.find('table.stats-individual tbody tr')
			.last()
			.append(
				$('<td>')
				.text(studentObj.counters.correct[th.text()] + '/' + allData.stats.questionsCounts[th.text()])
			);
		});
	});
}
/*
	Document ready function
*/
$(document).ready(function() {
	var IDs = getIDs();
	var labels = IDs.map(function(id) {
		return idToString(id);
	});
	var evaluatedData = evalAnswers();
	console.log(evaluatedData);
	//-- School tab
	let divisions = Object.keys(evaluatedData.divisions).sort();
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
			schoolReport(evaluatedData, schoolObj, $('#school .results-container'));
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
	$('#school button.print').click(function(){
		window.print();
	});
});
