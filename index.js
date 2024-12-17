const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken")
const cookieParser = require('cookie-parser')
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// Middleware 
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const logger = (req, res, next) => {
  console.log("Inside the logger");
  next();
}

const verifyToken = (req, res, next) => {
  // console.log("Inside verify token middleware");
  const token = req?.cookies?.token;

  if (!token) {
    return res.status(401).send({ messages: 'Unauthorized access' })
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized access' })
    }
    req.user = decode;
    next();
  })

}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dynrh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");


    const jobsCollection = client.db('jobPortal').collection('jobs');
    const jobApplicationCollection = client.db('jobPortal').collection('job_applications');

    // Auth related API's 
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.cookie('token', token, {
        httpOnly: true,
        secure: false
      })
        .send({ success: true });
    })

    // Jobs related API
    app.get('/jobs', logger, async (req, res) => {
      const email = req.query.email;
      let query = {};

      if (email) {
        query = { hr_email: email }
      }


      const cursor = jobsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post('/jobs', async (req, res) => {
      const newJob = req.body;
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    });

    app.get('/jobs/:id', async (req, res) => {
      const jobId = req.params.id;
      const query = { _id: new ObjectId(jobId) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    })

    // Job applicaton related API's

    app.get('/job-applicaiton', verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { aplicant_email: email };

      if(req.user.email !== req.query.email) {
        return res.status(403).send({ message: 'forbidden access'})
      }

      const result = await jobApplicationCollection.find(query).toArray();

      // To get job details 
      for (const applicaiton of result) {
        const query1 = { _id: new ObjectId(applicaiton.job_id) };
        const job = await jobsCollection.findOne(query1);

        if (job) {
          applicaiton.title = job.title;
          applicaiton.company = job.company;
          applicaiton.location = job.location;
          applicaiton.company_logo = job.company_logo;
        }
      }

      res.send(result);
    });


    app.get('/job-applications/jobs/:job_id', async (req, res) => {
      const jobId = req.params.job_id;
      const query = { job_id: jobId };
      const result = await jobApplicationCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/job-applications', async (req, res) => {
      const application = req.body;
      const result = await jobApplicationCollection.insertOne(application);
      res.send(result);
    });

    app.patch('/job-applications/:id', async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: data.status,
        }
      }
      const result = await jobApplicationCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send("Job Portal Server is Running.")
})

app.listen(port, () => {
  console.log(`Job portal server is running on port: ${port}`)
})