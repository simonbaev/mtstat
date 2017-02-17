let questions = [];
let results = [];
const categoryOrder = Object.keys(mtData.questions);

$(document).ready(function() {
	
	//Question Objects
	categoryOrder.forEach(function (category) {	
		const categoryQuestions = Object.keys(mtData.questions[category]);	
		categoryQuestions.forEach(function (question) {
			const questionAsNumber = parseInt(question, 10) - 1;
			const answer = mtData.questions[category][question];
			questions[questionAsNumber] = { 
				answer: answer, 
				category: category, 
				answerCounts: [0, 0, 0, 0, 0, 0],
			};
		});
	});

	//Results
	let count = 0;
	mtData.rawData.forEach(function (row) {           
		const district = parseInt(row.substr(0, 1), 10);
		const school = parseInt(row.substr(1, 2), 10);
		const student = parseInt(row.substr(3, 1), 10);
		const answers = row.substr(4).split('').map(function (digit) { return parseInt(digit, 10); });         

		const validatedAnswers = answers.map(function (answer, i) {
			if (!questions[i]){ 
				return { correct: null, type: null };
			};	
			const correct = answer === questions[i].answer ? true : false;
			if(district != 0) {
				questions[i].answerCounts[answer] += 1;
			};
			return {
				correct: answer === 0 ? null : correct, 
				answer: answer,
				category: questions[i].category
			};
		});

		const correctAnswers = countAnswersByIsCorrect(true, validatedAnswers);
		const incorrectAnswers = countAnswersByIsCorrect(false, validatedAnswers);
		const answeredByCategory = categoryOrder.map(function(category) { 
			return countCorrectForCategory(category, validatedAnswers);
		});
		
		if(district != 0) {
			results[count] = {
				name: mtData.teams[district - 1].schools[school - 1].students[student - 1],
				schoolName: mtData.teams[district - 1].schools[school - 1].name,
				totalCorrect: correctAnswers,
				totalIncorrect: incorrectAnswers,
				correctByCategory: answeredByCategory,
				district: district,
				school: school,
				student: student,
				score: "0",
			};
		};
		count++;
	});

	mtData.teams.forEach(function(district, districtNum) {
		district.schools.forEach(function(school, schoolNum) {
			getTeamScores(districtNum, schoolNum);
		});
	});
	
	//Pre-emptively creates first result tab.
	tournyPost();
	
	let currentTab = $('#controlTabs').find('.active').text();	
	
	//Fills drops downs
	mtData.teams.forEach(function(district, i){
		$('#division-division')
		.append(
			$('<option>')
			.attr({
				'value': i
			})
			.text(district.division)
		);
		$('#school-division')
		.append(
			$('<option>')
			.attr({
				'value': i
			})
			.text(district.division)
		);
	});
	mtData.teams[0].schools.forEach(function(school, i) {
		$('#school-school')
		.append(
			$('<option>')
			.attr({
				'value': i
			})
			.text(school.name)
		);
	});
	
	//Change handlers
	$('#division-division').change(function(){
		$("#divisionContainer").empty();
		let division = $('#division-division').find('option:selected').val();
		divisionPost(division, $('#divisionContainer'));
	});

	$('#school-division').change(function(){
		$("#school-school").empty();
		let division = $('#school-division').find('option:selected').val();
		mtData.teams[division].schools.forEach(function(school, i) {
			$('#school-school')
			.append(
				$('<option>')
				.attr({
					'value': i
				})
				.text(school.name)
			);
		});
		$('#schoolContainer').empty();
		let school = $('#school-school').find('option:selected').val();
		schoolPost(division, school, $("#schoolContainer"));
	});
	
	$('#school-school').change(function(){
		$("#schoolContainer").empty();
		let division = $('#school-division').find('option:selected').val();
		let school = $('#school-school').find('option:selected').val();
		schoolPost(division, school, $("#schoolContainer"));
	});
	
	//Tab toggle
	$('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
		currentTab = $('#controlTabs').find('.active').text();
		switch(currentTab) {
			case "Tournament":
				$('#tourneyContainer').empty();
				tournyPost();
				break;
			case "Division":
				$('#divisionContainer').empty();
				divisionPost($('#division-division').find('option:selected').val(), $('#divisionContainer'));
				break;
			case "School":
				$('#schoolContainer').empty();
				let division = $('#school-division').find('option:selected').val();
				let school = $('#school-school').find('option:selected').val();
				schoolPost(division, school, $("#schoolContainer"));
				break;
			case "Bulk":
				$('#bulkContainer').empty();
				break;
			case "Error":
				$("#errorContainer").empty();
				postError();
				break;
			default:
				$("#participatingContainer").empty();
				postParticipating($('#participating-division').find('option:selected').val());
		};
	});
});

//Tournament-wide results
function tournyPost() {
	
	let allScores = [];
	results.forEach(function(current, i) {
		console.log(current.score);
		console.log(parseInt(current.score, 10));
		allScores[i] = parseInt(current.score, 10);
	});
	
	$("#tourneyContainer").append($('<center>').append($('<p>').text("*** ITEM ANALYSYS ***")));
	$("#tourneyContainer").append($('<center>').append($('<p>').text("The average of " + results.length + " scores = " + (average(allScores)).toFixed(2) + ", the standard deviation = " + (standardDeviation(allScores)).toFixed(2) + ".\n\n")));	
	$("#tourneyContainer").append($('<table>').addClass('table tourneyTable')
		.append(
			$('<thead>')
			.append(
				$('<tr>')
				.append($('<th>').text('Question'))
				.append($('<th>').text('Blanks'))
				.append($('<th>').text('First'))
				.append($('<th>').text('Second'))
				.append($('<th>').text('Third'))
				.append($('<th>').text('Fourth'))
				.append($('<th>').text('Fifth'))
				.append($('<th>').text('Category'))
				.append($('<th>').text('Percent'))
			)
		)
		.append(
			$('<tbody>')
		)
	)
	
	questions.forEach(function(current, i) {
		$("#tourneyContainer").find('table.tourneyTable:last tbody')
		.append(
			$('<tr>')
			.append($('<td>').text(i + 1))
		)
		
		current.answerCounts.forEach(function(counts, j) {
			$("#tourneyContainer").find('table.tourneyTable:last tbody tr:last')
				.append($('<td>').text(counts)
			)
			if(j == current.answer) {
				$("#tourneyContainer").find('table.tourneyTable:last tbody tr:last td:last').addClass('correctAnswer')
			}
		})
		
		$("#tourneyContainer").find('table.tourneyTable:last tbody tr:last')
			.append($('<td>').text(current.category))
			.append($('<td>').text((current.answerCounts[current.answer] / results.length * 100).toFixed(2))
		)
	});
	return;
};

//Per division results
function divisionPost(division, container) {
	
	let ranking = [];
	let schoolRanking = [];
	
	mtData.teams[division].schools.forEach(function(school, schoolNum) {
		let schoolSRanking = [];
		school.students.forEach(function(student, studentNum) {
			let isPresent = false;
			let rPos = 0;
			results.forEach(function(resultList, rNum) {
				if(student == resultList.name){
					isPresent = true;
					rPos = rNum;
				};
			});
			if(isPresent == true) {
				ranking.push({
					name: student,
					school: school.name,
					score: results[rPos].score,
				});
				schoolSRanking.push({
					name: student,
					school: school.name,
					score: results[rPos].score,
				});
			};
			if(isPresent == false) {
				ranking.push({
					name:student,
					school: school.name,
					score: 0,
				});
				schoolSRanking.push({
					name: student,
					school: school.name,
					score: results[rPos].score,
				});
			};
		});
		schoolSRanking = schoolSRanking.sort(function (a, b) {
			return a.score - b.score;
		});
		schoolSRanking = schoolSRanking.reverse();
		
		if(schoolSRanking.length >= 4) {
			schoolRanking.push({
				school: school.name,
				top4Score: (schoolSRanking[0].score + schoolSRanking[1].score + schoolSRanking[2].score + schoolSRanking[3].score)
			})
		}
		else {
			let top4Temp = 0;
			schoolSRanking.forEach(function(current) {
				top4Temp += current.score;
			})
			schoolRanking.push({
				school: school.name,
				top4Score: top4Temp
			})
		}

	});
	
	ranking = ranking.sort(function (a, b) {
		return a.score - b.score;
	});
	ranking = ranking.reverse();
	schoolRanking = schoolRanking.sort(function (a, b) {
		return a.score - b.score;
	});
	schoolRanking = schoolRanking.reverse();
	
	container.append($('<h3>').text(mtData.teams[division].division))
	container.append($('<table>').addClass('table divisionSchoolTable')
		.append(
			$('<thead>')
			.append(
				$('<tr>')
				.append($('<th>').text('Rank'))
				.append($('<th>').text('School'))
				.append($('<th>').text('Top 4 Scores'))
			)
		)
		.append(
			$('<tbody>')
		)
	)
	schoolRanking.forEach(function(current, i) {
		container.find('table.divisionSchoolTable:last tbody')
		.append(
			$('<tr>')
			.append($('<td>').text(i + 1))
			.append($('<td>').text(current.school))
			.append($('<td>').text(current.top4Score))
		)
	})
	
	container.append($('<table>').addClass('table divisionTable')
		.append(
			$('<thead>')
			.append(
				$('<tr>')
				.append($('<th>').text('Rank'))
				.append($('<th>').text('Student'))
				.append($('<th>').text('School'))
				.append($('<th>').text('Score'))
			)
		)
		.append(
			$('<tbody>')
		)
	)

	ranking.forEach(function(current, i) {
		container.find('table.divisionTable:last tbody')
		.append(
			$('<tr>')
			.append($('<td>').text(i + 1))
			.append($('<td>').text(current.name))
			.append($('<td>').text(current.school))
			.append($('<td>').text(current.score))
		)
	})

	let districtAverage = 0;
	let totalAve = 0;
	let stdDevData = [];
	ranking.forEach(function(rank, rankNum) {
		if(rank.score != 0) {
			districtAverage += rank.score;
			totalAve += 1;
		};
		stdDevData[rankNum] = rank.score;
	});
	
	stdDevData = stdDevData.filter(function(val) {
		return val !== 0;
	});
	
	container.append($('<p>').text("Average of " + totalAve + " scores =  " + (districtAverage / totalAve).toFixed(2) + ", Standard Deviation = " + standardDeviation(stdDevData).toFixed(2)))

	return;
};

//School results
function schoolPost(division, school, container) {
	container
		.append($('<p>').text(' '))
		.append(
			$('<center>').append($('<h4>').text(mtData.teams[division].division + " - " + mtData.teams[division].schools[school].name))
		)
		.append($('<hr>'))
		.append(
			$('<p>')
			.text(
				'The Score is computed using the formula 4C - I + 40, where C represents the number of correct responses and I represents the number of incorrect responses. Incomplete erasures and multiple marks are scored as incorrect responses.  Blank responses do not affect the score.  The table below shows only the score and the number correct. If you desire the number incorrect and the number left blank, you will have to deduce them from the scoring formula.'
			)
		)
		.append(
			$('<p>')
			.text(
				'We enjoyed having you as part of our activities today and hope that you found this to be a rewarding learning experience.  We look forward to seeing you at Georgia Southwestern at our other competitions and visitations during the year.'
			)
		)
		.append($('<hr>'))
		.append($('<p>').text("The following results are based upon all " + results.length + " participants."))
		.append($('<p>').text("Tournament-wide results by category:  (Percent correct)"))
		.append($('<table>').addClass('table schoolPercentTable')
			.append(
				$('<thead>')
				.append(
					$('<tr>')
					.append($('<th>').text('Algebra'))
					.append($('<th>').text('Analytic Geometry'))
					.append($('<th>').text('Geometry'))
					.append($('<th>').text('Trigonometry'))
					.append($('<th>').text('Miscellaneous'))
					.append($('<th>').text('Overall average'))
				)
			)
			.append(
				$('<tbody>').append($('<tr>'))
			)
	)
	let catCor = categoryOrder.reduce(toAverage, {})
	let catKeys = Object.keys(catCor);
	container.find('table.schoolPercentTable:last tbody tr')
			.append($('<td>').text(catCor[catKeys[0]]))
			.append($('<td>').text(catCor[catKeys[1]]))
			.append($('<td>').text(catCor[catKeys[2]]))
			.append($('<td>').text(catCor[catKeys[3]]))
			.append($('<td>').text(catCor[catKeys[4]]))
			.append($('<td>').text(totalCor())
	)
	container.append($('<hr>'))
	const scoreArray = getTeamScores(division, school);
	container.append($('<p>').text("Top 4 Total: " + scoreArray[0])).append($('<hr>'))
	container.append($('<p>').text("Ciphering Total: ")).append($('<hr>'))
	container.append($('<p>').text("Math Total: ")).append($('<hr>')).append($('<p>').text("Individual results on the multiple choice exam:"))
		.append($('<table>').addClass('table schoolStudentsTable')
			.append(
				$('<thead>')
				.append(
					$('<tr>')
					.append($('<th>').text('Rank'))
					.append($('<th>').text('Name'))
					.append($('<th>').text('Score'))
					.append($('<th>').text('ALGE'))
					.append($('<th>').text('ANGE'))
					.append($('<th>').text('GEOM'))
					.append($('<th>').text('TRIG'))
					.append($('<th>').text('MISC'))
					.append($('<th>').text('TOTAL'))
				)
			)
			.append(
				$('<tbody>').append($('<tr>'))
			)
		)
			
	mtData.teams[division].schools[school].students.forEach(function(student, studentNum) {
		let isPresent = false;
		let rPos = 0;
		results.forEach(function(resultList, rNum) {
			if(student == resultList.name){
				isPresent = true;
				rPos = rNum;
			};
		});
		if(isPresent == true) {
			container.find('table.schoolStudentsTable:last tbody').append($('<tr>')
				.append($('<td>').text(studentNum + 1))
				.append($('<td>').text(results[rPos].name))
				.append($('<td>').text(results[rPos].score))
			)
			results[rPos].correctByCategory.forEach(function(categoricalCorrect, catCount) {
				container.find('table.schoolStudentsTable:last tbody tr:last')
					.append($('<td>').text(categoricalCorrect + "/" + Object.keys(mtData.questions[Object.keys(mtData.questions)[catCount]]).length))
			});
			container.find('table.schoolStudentsTable:last tbody tr:last').append($('<td>').text(results[rPos].totalCorrect + "/" + questions.length))
		};
	});
};

//Labels
function postParticipating(division, partString) {
	try {
		mtData.teams[division].schools.forEach(function(school, i) {
			school.students.forEach(function(student, j) {
				partString += ((parseInt(division, 10) + 1) * 1000) + ((i + 1) * 10) + (j + 1) + ",\t\t"+ student + ",\t\t" + school.name + "\n";
			});
		});
	}
	catch(err) {
	}
	return partString;
};

//Correct counts
function countCorrectForCategory(category, answers) {
	const answersForCategory = filterAnswersByCategory(category, answers);
	return countAnswersByIsCorrect(true, answersForCategory);
};

function filterAnswersByCategory(category, answers) {
	let filteredList = [];
	answers.forEach(function(answer) {
		if (answer.category === category) {
			filteredList.push(answer);
		};
	});
	return filteredList;
};

function countAnswersByIsCorrect(isCorrect, answers) {
	let temp = 0;

	answers.forEach(function (answer) {
		if (answer.correct === null) return;
		if (answer.correct === isCorrect) {
			temp += 1;
			return;
		};
	});

	return temp;
};

//Sets the scores
function getTeamScores(districtNum, schoolNum) {
	let scoreArray = [];
	let iPCount = 0;
	mtData.teams[districtNum].schools[schoolNum].students.forEach(function(student, studentNum) {
		let isPresent = false;
		let rPos = 0;
		results.forEach(function(resultList, rNum) {
			if(student == resultList.name){
				isPresent = true;
				rPos = rNum;
			};
		});
		if(isPresent == true) {
			scoreArray[iPCount] = (4 * (results[rPos].totalCorrect)) - results[rPos].totalIncorrect + 40;
			results[rPos].score = scoreArray[iPCount];
			iPCount++;
		};
	});
	let largest = sortArray(scoreArray);
	if(largest.length >= 4) {
		largest = largest[0] + largest[1] + largest[2] + largest[3];
	}
	else {
		tLargest = 0;
		for(i = 0; i < largest.length; i++) {
			if(largest[i] > 0) {
				tLargest += largest[i];
			};
		};
		largest = tLargest;
	}
	return [largest, scoreArray];
};

//Sort function
function sortArray(scoreByPattern){
    scoreByPattern.sort(function(a,b) {
        if (a < b) { return 1; }
        else if (a == b) { return 0; }
        else { return -1; }
    });
	return scoreByPattern;
};

function toAverage(memo, categoryName) {
    const total = Object.keys(mtData.questions[categoryName]).length * results.length;
    const totalCorrect = results.reduce(function(memo, result) {
        return memo + result.correctByCategory[categoryOrder.indexOf(categoryName)];
    }, 0);
    memo[categoryName] = ((totalCorrect/total) * 100).toFixed(2);
	return memo;
};

function totalCor() {
	const totCor = results.reduce(function(total, cur) {
		return total + cur.totalCorrect;
	}, 0);
	return (((totCor / questions.length) / results.length) * 100).toFixed(2);
};

function standardDeviation(values) {

	const avg = average(values);
  
	const squareDiffs = values.map(function(value) {
		const diff = value - avg;
		const sqrDiff = diff * diff;
		return sqrDiff;
	});

	return Math.sqrt(average(squareDiffs));
};

function average(data) {
	let sum = data.reduce(function(sum, value) {
		return sum + value;
	}, 0);
	return sum / data.length;
};

function postError() {
	mtData.teams.forEach(function(district, districtNum) {
		district.schools.forEach(function(school, schoolNum) {
			school.students.forEach(function(student, studentNum) {
				let fCount = 0;
				results.forEach(function(rStudents) {
					if(rStudents.name != student) {
						fCount++;
					};
				});
				if(fCount == results.length) {
					$("#errorContainer").append(
						$('<p>')
						.text("WARNING: No EXAM turned in for student # " + (studentNum + 1) +" from school # " + (schoolNum + 1) + " in division # " + (districtNum + 1) + "\n"));
				};
			});
		});
	});
	return;
};


//Bulk print/download options
function bulkSchool() {
	$('#bulkSchoolContainer').empty();
	$('#bulkDivisionContainer').empty();
	mtData.teams.forEach(function(district, i) {
		district.schools.forEach(function(school, j) {
			schoolPost(i, j, $('#bulkSchoolContainer'));
		});
	});
	window.print();
};
function bulkDivision() {
	$('#bulkSchoolContainer').empty();
	$('#bulkDivisionContainer').empty();
	mtData.teams.forEach(function(district, i) {
		divisionPost(i, $('#bulkDivisionContainer'));
	});
	window.print();
};

function bulkParticipating() {
	let partString = "";
	mtData.teams.forEach(function(current, i) {
		partString = postParticipating(i, partString);
	});
	
	$('#downloadButton')
	.attr({
		'href': 'data:application/csv;charset=UTF-8,' + encodeURIComponent(partString),
		'download': 'labels.csv'
	});
}
