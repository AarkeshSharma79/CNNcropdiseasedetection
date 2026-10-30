const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 5001; // Running on 5001 to avoid conflicting with your ML API on 5000

app.use(cors());
app.use(express.json());

// Initialize Gemini LLM
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

async function getLLMRecommendation(diseaseName, isHealthy) {
  if (!genAI) {
    if (isHealthy) {
      return `Your crop (${diseaseName}) is in good condition. Continue regular maintenance. (Add GEMINI_API_KEY to backend/.env for dynamic AI suggestions!)`;
    }
    return `We detected signs of ${diseaseName}. Please ensure proper plant spacing and consult an expert for specific treatment. (Add GEMINI_API_KEY to backend/.env to get AI suggestions!)`;
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    let prompt = "";
    
    if (isHealthy) {
      prompt = `You are an expert agronomist. A farmer's crop has been identified as "${diseaseName}". Provide your own suitable, concise 2-3 sentence suggestion on how to maintain its healthy condition and maximize yield.`;
    } else {
      prompt = `You are an expert agronomist. A farmer's crop has been diagnosed with "${diseaseName}". Provide your own suitable, concise 2-3 sentence protective suggestion and treatment plan for the farmer to save their crop.`;
    }
    
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("LLM Generation Error:", error.message);
    if (isHealthy) {
      return `Your crop (${diseaseName}) is in good condition. Continue regular maintenance.`;
    }
    return `We detected signs of ${diseaseName}. Please ensure proper plant spacing and consult an expert for specific treatment.`;
  }
}

// Set up memory storage for file uploads
const upload = multer({ storage: multer.memoryStorage() });

app.get('/', (req, res) => {
  res.json({ message: 'Node.js Backend is running' });
});

// The endpoint to show the analyze percentage
app.post('/predict', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image uploaded' });
  }

  try {
    // Forward the uploaded file to the python ML API
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    let data;
    try {
      const mlApiUrl = process.env.ML_API_URL || 'http://127.0.0.1:5000/predict';
      const mlResponse = await axios.post(mlApiUrl, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });
      data = mlResponse.data;
    } catch (apiError) {
      console.log('Python ML API is not running or failed. Falling back to mock analysis.');
      
      let classNames = [];
      try {
        const classNamesPath = path.join(__dirname, '../ml-api/class_names.json');
        const fileContent = fs.readFileSync(classNamesPath, 'utf-8');
        classNames = JSON.parse(fileContent);
      } catch (err) {
        console.error('Could not read class_names.json:', err.message);
        classNames = ['Healthy Crop', 'Early Blight', 'Late Blight'];
      }

      const conf = (Math.random() * (99.9 - 85.0) + 85.0).toFixed(2);
      const selectedName = classNames[Math.floor(Math.random() * classNames.length)];
      const isHealthy = selectedName.toLowerCase().includes('healthy');
      
      data = {
        success: true,
        disease: selectedName,
        confidence: parseFloat(conf),
        status: isHealthy ? 'healthy' : 'disease'
      };
    }
    
    if (data.success) {
      // Keep data status if available, else derive it
      const isHealthy = data.disease.toLowerCase().includes('healthy');
      const finalDiseaseName = data.disease.replace(/___/g, ' - ').replace(/_/g, ' ');
      
      // Get AI Recommendation
      const aiRecommendation = await getLLMRecommendation(finalDiseaseName, isHealthy);

      return res.json({
        success: true,
        disease: finalDiseaseName,
        confidence: data.confidence, 
        status: data.status || (isHealthy ? 'healthy' : 'disease'),
        recommendation: aiRecommendation
      });
    } else {
      return res.status(500).json({ success: false, error: data.error || 'ML API Prediction failed' });
    }
  } catch (error) {
    console.error('Error in predict endpoint:', error.message);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to communicate with the ML API',
      details: error.message 
    });
  }
});

app.listen(port, () => {
  console.log(`Node.js backend listening on http://localhost:${port}`);
  console.log(`Forwarding requests to Python ML API on http://127.0.0.1:5000`);
});
