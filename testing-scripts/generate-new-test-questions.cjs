const fs = require('fs');

// Load the interactive testing data
const interactiveData = JSON.parse(fs.readFileSync('testing-scripts/interactive-testing-data.json', 'utf8'));

// Generate JavaScript array for the HTML file
function generateTestQuestionsArray() {
  let jsArray = '        const testQuestions = [\n';
  
  interactiveData.questions.forEach((categoryData, categoryIndex) => {
    categoryData.questions.forEach((questionData, questionIndex) => {
      const isLast = categoryIndex === interactiveData.questions.length - 1 && 
                    questionIndex === categoryData.questions.length - 1;
      
      jsArray += `            {\n`;
      jsArray += `                category: "${questionData.category}",\n`;
      jsArray += `                question: "${questionData.question}",\n`;
      jsArray += `                focus: "${questionData.focus}",\n`;
      jsArray += `                expectedType: "advice"\n`;
      jsArray += `            }${isLast ? '' : ','}\n`;
    });
  });
  
  jsArray += '        ];';
  
  return jsArray;
}

const newTestQuestionsArray = generateTestQuestionsArray();

console.log('📝 NEW TEST QUESTIONS ARRAY:');
console.log('================================================================================');
console.log(newTestQuestionsArray);

// Save to a file for easy copying
fs.writeFileSync('testing-scripts/new-test-questions-array.js', newTestQuestionsArray);

console.log('\n💾 SAVED TO: testing-scripts/new-test-questions-array.js');
console.log('📊 Total Questions: 40');
console.log('📊 Categories: 8');
console.log('📊 Questions per Category: 5');
