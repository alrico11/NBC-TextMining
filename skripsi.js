const readlineSync = require('readline-sync');
const figlet = require('figlet');
const chalk = require('chalk');
const axios = require('axios');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();
var sastrawi = require("sastrawijs");
var stemmer = new sastrawi.Stemmer();

console.log(
  chalk.redBright(
    figlet.textSync('SKRIPSI', { horizontalLayout: 'fitted' })
  )
);

let o = 1;
const Judul = [];
let trainingData = [];
let testData = [];
let combinedData = []
let positiveSentimentTFIDF
let negativeSentimentTFIDF

async function getNewsFromURL() {
  const pages = readlineSync.question(chalk.whiteBright('[+] Input jumlah halaman yang diinginkan : '));
  for (let halaman = 1; halaman <= pages; halaman++) {
    try {
      process.stdout.write(`[@] Processing Get All News ${halaman} Of Pages \r`);
      const response = await axios.get(
        `https://www.kompas.tv/section/more?sort_by=recent&limit=12&offset=${o}&id=&api_url=article_tag&tag=semarang&search=&type=&jsonPath=`
      );
      const dom = new JSDOM(response.data);

      for (let i = 1; i <= 12; i++) {
        const judulBerita = dom.window.document.querySelector(`body > div:nth-child(${i}) > div.col-70 > h2 > a`).textContent;
        Judul.push(judulBerita);
        // tfidf.addDocument(stemmer.tokenizeAndStem(judulBerita));
      }

      o += 12;
    } catch (err) {
      console.error('Error:', err.message);
    }
  }
}

function saveToCSV(data, filename) {
  if (data.length === 0) {
    console.log("Tidak ada data untuk disimpan.");
    return;
  }
  const csvContent = data.map(item => `"${item}"`).join('\n');
  fs.writeFileSync(filename, csvContent, 'utf-8');

}

function getBerita() {
  console.log("");
  if (Judul.length === 0) {
    console.log("Judul berita kosong, import CSV / input berita");
  }
  for (let r = 0; r < Judul.length; r++) {
    console.log(chalk.redBright(`${r + 1}. ${Judul[r]}`));
  }
}

function importFromCSV(file) {
  try {
    const data = fs.readFileSync(file, 'utf8');
    const lines = data.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
      const judul = lines[i].trim().replace(/"/g, '');
      Judul.push(judul);
    }
    console.log('Data berhasil diimpor dari file CSV.');
  } catch (error) {
    console.error('Error:', error.message);
  }
}
function preprocessTextAndSaveToCSV() {
  if (Judul[0] != undefined) {
    const customStopwordsFile = 'customstopwords.txt';
    const kataDasarFile = 'katadasar.txt';
    const customStopwords = fs.readFileSync(customStopwordsFile, 'utf-8').split('\n').map(word => word.trim());
    const stopwords = customStopwords.reduce((stopwords, word) => {
      stopwords[word] = true;
      return stopwords;
    }, {});

    const kataDasarList = fs.readFileSync(kataDasarFile, 'utf-8').split('\n').map(word => word.toLowerCase().split(' ')[0].trim());

    const kataDasar = kataDasarList.reduce((kataDasar, word) => {
      kataDasar[word] = true;
      return kataDasar;
    }, {});
    // Daftar imbuhan yang ingin dihapus
    const preprocessedData = Judul.map((judul) => {
      const tokens = tokenizer.tokenize(judul.toLowerCase());
      const cleanedTokens = tokens.map((token) => {
        let cleanedToken = token;
        let isTokenValid = false;
        // Periksa apakah token ada dalam kata dasar
        if (token == "vs") {
          cleanedToken = "versus"
          isTokenValid = true;
        }
        if (kataDasar[cleanedToken]) {
          isTokenValid = true;
        }
        if (!isTokenValid) {
          if (!isTokenValid) {
            let stemming = stemmer.stem(token);
            if (kataDasar[stemming]) {
              cleanedToken = stemming;
              isTokenValid = true;
            }
          }
        }
        // Hapus karakter non-alphabet
        cleanedToken = cleanedToken.replace(/[^a-z]+/ig, '');
        // Setelah semua pengecekan, token yang valid masih disimpan
        if (cleanedToken.length >= 2 && !stopwords[cleanedToken] && isTokenValid) {
          return cleanedToken;
        }
        return '';
      });
      const nonEmptyTokens = cleanedTokens.filter(token => token.trim() !== ''); // Hapus token kosong
      console.log(nonEmptyTokens.join(','));
      return nonEmptyTokens.join(','); // Kolom pertama adalah judul asli, kolom kedua adalah hasil preprocessing
    });
    const nonEmptyPreprocessedJudul = preprocessedData.filter((judul) => judul.trim() !== '');
    console.log(nonEmptyPreprocessedJudul)
    saveToCSV(nonEmptyPreprocessedJudul, 'preprocessed_berita.csv');
    saveToCSV(nonEmptyPreprocessedJudul, 'preprocessed_berita.csv');
    console.log('Data yang sudah diproses berhasil disimpan ke preprocessed_berita.csv');
  } else {
    console.log("Judul berita kosong, import CSV / input berita");
  }
}
function calculateTFIDFForCombinedData(combinedData) {
  const documentCount = combinedData.length;
  const termFrequency = {};
  const documentFrequency = {};
  const inverseDocumentFrequency = {};
  const uniqueTerms = new Set();

  combinedData.forEach((dataItem, index) => {
    const tokenizedRow = dataItem.text.replace(/"/g, '');
    const tokens = tokenizedRow.split(',');

    if (tokens.length === 0) {
      return;
    }

    const tfDocument = {};
    tokens.forEach((token) => {
      const cleanedToken = token.trim().replace(/\r/g, '');
      if (cleanedToken !== '') {
        if (!tfDocument[cleanedToken]) {
          tfDocument[cleanedToken] = 0;
        }
        tfDocument[cleanedToken]++;
        uniqueTerms.add(cleanedToken);
      }
    });

    for (const term in tfDocument) {
      if (!termFrequency[term]) {
        termFrequency[term] = {};
      }
      termFrequency[term][index] = tfDocument[term];
      if (!documentFrequency[term]) {
        documentFrequency[term] = 0;
      }
      documentFrequency[term]++;
    }
  });

  for (const term in documentFrequency) {
    inverseDocumentFrequency[term] = Math.log10(documentCount / documentFrequency[term]);
  }

  const tfidfData = [];
  uniqueTerms.forEach((term) => {
    for (let i = 0; i < documentCount; i++) {
      const TF = termFrequency[term][i] || 0;
      const DF = documentFrequency[term] || 0;
      const IDF = inverseDocumentFrequency[term] || 0;
      const TFIDF = TF * IDF;

      const cleanedTerm = term.replace(/\r/g, '').trim();

      if (cleanedTerm !== '' && TF > 0) {
        tfidfData.push({ documentIndex: i + 1, term: cleanedTerm, TF, DF, IDF, TFIDF });
      }
    }
  });

  return tfidfData;
}


function readTrainingAndTestDataFromCSV(trainingFilename, testFilename) {
  try {
    const preprocessedData = [];
    const dfSentimenPositive = {};
    const dfSentimenNegative = {};

    // Read and preprocess training data
    const trainingDataRaw = fs.readFileSync(trainingFilename, 'utf8');
    const trainingLines = trainingDataRaw.trim().split('\n');

    for (let i = 0; i < trainingLines.length; i++) {
      const line = trainingLines[i].trim().split(",");
      if (line.length > 1) {
        const text = line.slice(0, -1).join(",").replace(/"/g, "");
        const sentiment = line[line.length - 1];
        const dataItem = { text, sentiment };
        preprocessedData.push(text);
        trainingData.push(dataItem);

        const terms = text.split(',');
        const uniqueTerms = Array.from(new Set(terms));

        uniqueTerms.forEach(term => {
          if (!dfSentimenPositive[term]) {
            dfSentimenPositive[term] = 0;
          }

          if (!dfSentimenNegative[term]) {
            dfSentimenNegative[term] = 0;
          }

          if (sentiment === 'Positive') {
            dfSentimenPositive[term]++;
          } else if (sentiment === 'Negative') {
            dfSentimenNegative[term]++;
          }
        });

        // Add dfSentimenPos and dfSentimenNeg to the data item
        dataItem.dfSentimenPos = dfSentimenPositive;
        dataItem.dfSentimenNeg = dfSentimenNegative;
      }
    }

    // Read and preprocess test data
    const testDataRaw = fs.readFileSync(testFilename, 'utf8');
    const testLines = testDataRaw.trim().split('\n');

    for (let i = 0; i < testLines.length; i++) {
      const line = testLines[i].trim().split(",");
      if (line.length > 0) {
        const text = line.join(",").replace(/"/g, "");
        const dataItem = { text };
        preprocessedData.push(text);
        testData.push(dataItem);
     }
    }

    // Combine training and test data
    combinedData = [...trainingData, ...testData];
   
    // Calculate TF-IDF for combined data
    const tfidfData = calculateTFIDFForCombinedData(combinedData);

    // Attach TF-IDF to each item in combinedData
    for (let i = 0; i < combinedData.length; i++) {
      const documentIndex = i + 1;
      combinedData[i].TFIDF = tfidfData.filter((item) => item.documentIndex === documentIndex);
    
      // Initialize dfSentimenPos and dfSentimenNeg for each term
      combinedData[i].dfSentimenPos = {};
      combinedData[i].dfSentimenNeg = {};
    
      const terms = combinedData[i].text.split(',');
    
      terms.forEach(term => {
        combinedData[i].dfSentimenPos[term] = dfSentimenPositive[term] || 0;
        combinedData[i].dfSentimenNeg[term] = dfSentimenNegative[term] || 0;
    
        // Add dfSentimenPos and dfSentimenNeg directly to TFIDF items
        const tfidfItem = combinedData[i].TFIDF.find(item => item.term === term);
        if (tfidfItem) {
          tfidfItem.dfSentimenPos = combinedData[i].dfSentimenPos[term];
          tfidfItem.dfSentimenNeg = combinedData[i].dfSentimenNeg[term];
        }
      });
    }
    

    let csvOutputTraining = 'Term,TF,DF,IDF,TF-IDF,Sentimen,DF-Sentimen-Positive,DF-Sentimen-Negative\n';
    let csvOutputTest = 'Term,TF,DF,IDF,TF-IDF\n';
    let csvOutputCombined = 'Term,TF,DF,IDF,TF-IDF,Sentimen,DF-Sentimen-Positive,DF-Sentimen-Negative\n';

    const uniqueTermsCombined = Array.from(new Set(tfidfData.map(item => item.term)));

    for (const term of uniqueTermsCombined) {
      const item = tfidfData.find(item => item.term === term);
      const sentiment = combinedData[item.documentIndex - 1].sentiment || ''; // Assuming sentiment is present in the combined data
      const dfSentimenPos = dfSentimenPositive[term] || 0;
      const dfSentimenNeg = dfSentimenNegative[term] || 0;

      csvOutputCombined += `${term},${item.TF},${item.DF},${item.IDF},${item.TFIDF},${sentiment},${dfSentimenPos},${dfSentimenNeg}\n`;
    }

    positiveSentimentTFIDF = tfidfData
      .filter((item) => combinedData[item.documentIndex - 1].sentiment === 'Positive')
      .map((item) => item.TFIDF)
      .reduce((acc, val) => acc + val, 0);

    negativeSentimentTFIDF = tfidfData
      .filter((item) => combinedData[item.documentIndex - 1].sentiment === 'Negative')
      .map((item) => item.TFIDF)
      .reduce((acc, val) => acc + val, 0);

    csvOutputTraining += `\nTotal TF-IDF Positive,${positiveSentimentTFIDF}\n`;
    csvOutputTraining += `Total TF-IDF Negative,${negativeSentimentTFIDF}\n`;

    fs.writeFileSync('TF-IDF-Training.csv', csvOutputTraining, 'utf-8');
    console.log('Data TF-IDF Training telah disimpan dalam TF-IDF-Training.csv');

    fs.writeFileSync('TF-IDF-Test.csv', csvOutputTest, 'utf-8');
    console.log('Data TF-IDF Test telah disimpan dalam TF-IDF-Test.csv');

    fs.writeFileSync('TF-IDF-Combined.csv', csvOutputCombined, 'utf-8');
    console.log('Data TF-IDF Combined telah disimpan dalam TF-IDF-Combined.csv');
    console.log(testData)
    combinedData = trainingData.concat(testData);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Function to calculate Naive Bayes probabilities

function calculateNaiveBayesProbabilities(testData,combinedData) {
  let csvData;
  try {
    let totalV = 0;

    const resultObject = {
      terms: [],
      positiveProbabilities: [],
      negativeProbabilities: [],
      predictedSentiments: [],
    };

    for (let i = 0; i < testData.length; i++) {
      const textString = testData[i].text;
      if (textString) {
        const textArray = textString.split(',');
        testData[i].text = textArray;
      }
    }

    const uniqueTermsSet = new Set();

    for (const item of combinedData) {
      for (const tfidfItem of item.TFIDF) {
        // Add each term to the set
        uniqueTermsSet.add(tfidfItem.term);
      }
    }
    // Get the total number of unique terms
    totalV = uniqueTermsSet.size;
    for (let i = 0; i < testData.length; i++) {
      let probDocPositive = 0; // Reset for each document
      let probDocNegative = 0; // Reset for each document

      const textKey = testData[i].text.join(',');
      const logs = [];

      for (let j = 0; j < testData[i].TFIDF.length; j++) {
        const term = testData[i].TFIDF[j].term;
        let positiveProbability = (testData[i].TFIDF[j].dfSentimenPos + 1) / (positiveSentimentTFIDF.toFixed(5) + totalV);
        let negativeProbability = (testData[i].TFIDF[j].dfSentimenNeg + 1) / (negativeSentimentTFIDF.toFixed(5) + totalV);
        probDocPositive += positiveProbability;
        probDocNegative += negativeProbability;
        logs.push(`P(${term}|Positif)=(${testData[i].TFIDF[j].dfSentimenPos}+1)/(${positiveSentimentTFIDF.toFixed(5)}+${totalV})=${positiveProbability.toFixed(5)}`);
        logs.push(`P(${term}|Negatif)=(${testData[i].TFIDF[j].dfSentimenNeg}+1)/(${negativeSentimentTFIDF.toFixed(5)}+${totalV})=${negativeProbability.toFixed(5)}`);
      }

      logs.push(`Total P( Positif ) = ${probDocPositive.toFixed(5)}`);
      logs.push(`Total P( Negatif ) = ${probDocNegative.toFixed(5)}`);
     
      
      // Output logs for each document
      console.log(`${i+1}. Dokumen ke-${i+1} (${textKey})`);
      logs.forEach(log => console.log(log));
      if (probDocNegative > probDocPositive) {
       
        resultObject.terms.push(textKey);
        resultObject.positiveProbabilities.push(probDocPositive.toFixed(5));
        resultObject.negativeProbabilities.push(probDocNegative.toFixed(5));
        resultObject.predictedSentiments.push('Negative');
        console.log(`Berdasarkan perbandingan total probabilitas sentimen positif dan negatif, maka dokumen ke-${i+1} bersentimen negatif`)
      } else {
        
        resultObject.terms.push(textKey);
        resultObject.positiveProbabilities.push(probDocPositive.toFixed(5));
        resultObject.negativeProbabilities.push(probDocNegative.toFixed(5));
        resultObject.predictedSentiments.push('Positive');
        console.log(`Berdasarkan perbandingan total probabilitas sentimen positif dan negatif, maka dokumen ke-${i+1} bersentimen positif`)
      }
      console.log("")
    }

    csvData = resultObject.terms
      .map(
        (term, index) =>
          `"${term}",${resultObject.positiveProbabilities[index]},${resultObject.negativeProbabilities[index]},${resultObject.predictedSentiments[index]}`
      )
      .join('\n');

    fs.writeFileSync('HasilAnalisisSentimen.csv', `Terms,Positive Probability,Negative Probability,Predicted Sentiment,Truth Sentiment\n${csvData.replace(/\n/g, '\r\n')}`);
    console.log('Results saved to Klasifikasi HasilAnalisisSentimen.csv');
  } catch (error) {
    console.error('Error:', error);
  }
}


function readSentimenResult(filename) {
  try {
    const data = fs.readFileSync(filename, 'utf8');
    const lines = data.trim().split('\n');
    const dataResult = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim().split(",");
      if (line.length > 1) {
        const title = line.slice(0, -1).join(",").replace(/"/g, "");
        const sentimentPredict = line[line.length - 2];
        const sentimentTruth = line[line.length - 1];
        dataResult.push({ title, sentimentPredict, sentimentTruth });
      }
    }
    return dataResult;
  } catch (error) {
    console.error('Error:', error.message);
    return [];
  }
}

function calculateMetrics(dataResult) {
  let truePositives = 0;
  let trueNegatives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  const sentimenAnalis = 'HasilAnalisisSentimen.csv';
  if (fs.existsSync(sentimenAnalis)) {
    dataResult.forEach((item) => {
      if (item.sentimentPredict === 'Positive' && item.sentimentTruth === 'Positive') {
        truePositives++;
      } else if (item.sentimentPredict === 'Negative' && item.sentimentTruth === 'Negative') {
        trueNegatives++;
      } else if (item.sentimentPredict === 'Positive' && item.sentimentTruth === 'Negative') {
        falsePositives++;
      } else if (item.sentimentPredict === 'Negative' && item.sentimentTruth === 'Positive') {
        falseNegatives++;
      }
    });
    const accuracy = ((truePositives + trueNegatives) / (truePositives + trueNegatives + falsePositives + falseNegatives)) * 100;
    const precisionNegative = trueNegatives / (trueNegatives + falseNegatives);
    const recallNegative = trueNegatives / (trueNegatives + falsePositives);
    const precisionPositive = truePositives / (truePositives + falsePositives);
    const recallPositive = truePositives / (truePositives + falseNegatives);

    console.log('\n---------------------------------------------------------');
    console.log('|                   |            Sentimen Asli              ');
    console.log('| Prediksi Sentimen | POSITIF         |        NEGATIF  ');
    console.log('|-------------------|------------------------------------');
    console.log(`| POSITIF           | ${truePositives}                        ${falsePositives}        `);
    console.log(`| NEGATIF           | ${falseNegatives}                        ${trueNegatives}        `);
    console.log('---------------------------------------------------------');
    console.log('\nConfusion Matrix:');
    console.log(`- True Positives: ${truePositives}`);
    console.log(`- True Negatives: ${trueNegatives}`);
    console.log(`- False Positives: ${falsePositives}`);
    console.log(`- False Negatives: ${falseNegatives}`);
    console.log('Result:');
    console.log(`- Akurasi: ${accuracy.toFixed(2)} %`);
    console.log(`- Presisi Kelas Negatif: ${precisionNegative.toFixed(2)}`);
    console.log(`- Recall Kelas Negatif: ${recallNegative.toFixed(2)}`);
    console.log(`- Presisi Kelas Positif: ${precisionPositive.toFixed(2)}`);
    console.log(`- Recall Kelas Positif: ${recallPositive.toFixed(2)}`);
    menu()
  }
  else {
    console.error(`File '${sentimenAnalis}' tidak ditemukan.`);
    menu()
  }
}

async function menu() {
  console.log("\n\n========================== MENU ================================");
  console.log("[1] Input news");
  console.log("[2] Get news");
  console.log("[3] Save CSV");
  console.log("[4] Import CSV");
  console.log("[5] Preprocessing");
  console.log("[6] Calculate TF-IDF - Train Dataset - NBC Classification");
  console.log("[7] Confussion Matrix");
  console.log("==================================================================");
  var pilihMenu = readlineSync.question(chalk.whiteBright('\n[+] Menu : '));
  switch (pilihMenu) {
    case "1":
      await getNewsFromURL();
      menu();
      break;
    case "2":
      getBerita();
      menu();
      break;
    case "3":
      if (Judul.length > 0) {
        saveToCSV(Judul, "berita.csv");
      } else {
        console.log(chalk.redBright("Tidak ada data berita yang tersedia."));
      }
      menu();
      break;
    case "4":
      const file = readlineSync.question(chalk.whiteBright('[+] Input file : '));
      importFromCSV(file);
      menu();
      break;
    case "5":
      preprocessTextAndSaveToCSV();
      menu();
      break;
    case "6":
      readTrainingAndTestDataFromCSV("training.csv", "preprocessed_berita.csv");
      calculateNaiveBayesProbabilities(testData,combinedData);
      menu();
      break;
    case "7":
      calculateMetrics(readSentimenResult("HasilAnalisisSentimen.csv"));
      break;
    default:
      menu();
  }
}
menu();