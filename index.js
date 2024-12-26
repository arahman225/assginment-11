// Import dependencies
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;

// Middleware configuration
const corsOptions = {
  origin: ['https://assignment-test-11.netlify.app'],
  credentials: true, // Allow cookies and other credentials
  optionsSuccessStatus: 200, // Corrected property name
};

// Apply middlewares
app.use(cors(corsOptions)); // CORS configuration
app.use(express.json()); // For parsing JSON requests
app.use(cookieParser()); // To parse cookies









const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2cslr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


// verifyToken
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token
  if (!token) return res.status(401).send({ message: 'unauthorized access' })
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
  })

  next()
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();


    const carCollections = client.db("carRentelDB").collection("cars");
    const bookingsCollection = client.db("carBookingsDB").collection("bookings")





    // jwt token ------------------------------------

    app.post('/jwt', async(req, res) =>{
      const userEmail = req.body;
      const token = jwt.sign(userEmail, process.env.JWT_SECRET, {
        expiresIn: '1h'
      })
      console.log(token)
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      })
      .send({success: true})
    })

    app.get('/jwt', (req, res) => {
      res.json({ message: 'JWT route accessible' });
    });

    // clear cookies------------

    app.get('/logout', async (req, res) => {
      res
        .clearCookie('token', {
          maxAge: 0,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })

    // add car -----------------------------

    app.post('/add-car', async (req, res) => {
      const car = req.body;
      const result = await carCollections.insertOne(car)
      res.send(result)
    })



    // get method----------

    app.get('/cars', async (req, res) => {
      const email = req.query.email;

      let query = {}
      if (email) {
        query = { hr_email: email }
      }

      const cars = carCollections.find(query)
      const result = await cars.toArray()
      res.send(result)
    })


    app.get('/cars/:email', verifyToken, async (req, res) => {
      const email = req.params.email; // Accessing email from params


      const query = { hr_email: email }; // Building the query

      const decodedEmail = req.user?.userEmail
      
      if (decodedEmail !== email)
        return res.status(401).send({ message: 'unauthorized access' })
      const cars = carCollections.find(query); // Querying the collection
      const result = await cars.toArray(); // Converting to an array
      res.send(result); // Sending the response
  });

    // get car using only id

    app.get('/cars/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const result = await carCollections.findOne(filter)
      res.send(result)
    })

    // delete data ------------
    app.delete('/cars/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await carCollections.deleteOne(query)
      res.send(result)
    })


    // update method

    app.put('/cars/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const {
          carModel,
          dailyPrice,
          availability,
          registrationNumber,
          features,
          description,
          location,
          photoUrl,
          images,
        } = req.body;

        // Handle features properly
        const updateFeatures =
          typeof features === 'string'
            ? features.split(",").map((feature) => feature.trim())
            : Array.isArray(features)
              ? features
              : undefined;

        const updateCarInfo = {
          $set: {
            carModel: carModel,
            dailyPrice: dailyPrice,
            availability: availability,
            registrationNumber: registrationNumber,
            features: updateFeatures,
            description: description,
            location: location,
            photoUrl: photoUrl,
            images: images,
          },
        };

        const result = await carCollections.updateOne(filter, updateCarInfo);
        res.send(result);
      } catch (error) {
        console.error("Error updating car:", error);
        res.status(500).send({ error: "Failed to update car information." });
      }
    });



    // booking information


    //2. filter for increasing
    // const filter = {_id: new ObjectId(bidData.jobId)}
    // const update = {
    //   $inc:{bid_count: 1}
    // }

    // const updateBidCount = await addedJobs.updateOne(filter, update)

    app.post('/bookings', async (req, res) => {
      const bookingData = req.body;

      //1.  filter user email if user already booked
      const query = { email: bookingData.email, carId: bookingData.carId }
      const alreadyBooked = await bookingsCollection.findOne(query)
      console.log('already booked this car', alreadyBooked)
      if (alreadyBooked) {
        return res.status(400).send('You have already booked in this car')
      }
      const result = await bookingsCollection.insertOne(bookingData)


      //2. filter for increasing
      const filter = { _id: new ObjectId(bookingData.carId) }
      const updateCount = {
        $inc: { bookingCount: 1 }
      }

      const updateBookingCount = await carCollections.updateOne(filter, updateCount)
      console.log(updateBookingCount)
      res.send(result)
    })


    // get bookings info
    app.get('/bookings', async (req, res) => {
      const bookings = bookingsCollection.find()
      const result = await bookings.toArray()
      res.send(result)
    })


    app.get('/bookings/:email', verifyToken,  async (req, res) => {
      const email = req.params.email;

      const decodedEmail = req.user?.userEmail
      

      const query = { email }
      if (decodedEmail !== email)
        return res.status(401).send({ message: 'unauthorized access' })
      const result = await bookingsCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/bookingRequet/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.user?.userEmail
      const query = { buyerEmail: email }
      if (decodedEmail !== email)
        return res.status(401).send({ message: 'unauthorized access' })
      const result = await bookingsCollection.find(query).toArray()
      res.send(result)
    })





    // update booking date
    app.patch('/bookingRequet/:id', async (req, res) => {
      const id = req.params.id
      const { bookingDate } = req.body

      const filter = { _id: new ObjectId(id) }
      const updated = {
        $set: { bookingDate }
      }
      const result = await bookingsCollection.updateOne(filter, updated)

      res.send(result)
    })


    // 
    app.patch('/booking-request-update/:id', async (req, res) => {
      const id = req.params.id
      const { status } = req.body

      const filter = { _id: new ObjectId(id) }
      const updated = {
        $set: { status }
      }

      const result = await bookingsCollection.updateOne(filter, updated)
      console.log(result)
      res.send(result)
    })


    // patch method for accepting client request

    // app.patch('/booking-request-accept/:id', async (req, res) => {
    //   const id = req.params.id;
    //   const { status, availability } = req.body;

    //   const filter = { _id: new ObjectId(id) }
    //   const updatedAccept = {
    //     $set: {
    //       status, availability
    //     }
    //   }

    //   const result = await bookingsCollection.updateOne(filter, updatedAccept)
    //   console.log(result)
    //   res.send(result)
    // })

    app.patch('/booking-request-accept/:id', async (req, res) => {
      const id = req.params.id;
      const { status, availability, carId } = req.body; // Add carId in the request body to identify the car in carCollections
    
      const filter = { _id: new ObjectId(id) };
      const updatedAccept = {
        $set: {
          status,
          availability, // Update availability in the bookings collection if needed
        },
      };
    
      try {
        // Update bookingsCollection
        const bookingUpdateResult = await bookingsCollection.updateOne(filter, updatedAccept);
    
        // Update carCollections
        const carFilter = { _id: new ObjectId(carId
           
        ) }; // Match the car by carId
        const carUpdate = {
          $set: {
            availability, // Update availability in the cars collection
          },
        };
        const carUpdateResult = await carCollections.updateOne(carFilter, carUpdate);
        
        console.log(carUpdateResult)
        // Send a combined response
        res.send({
          bookingUpdateResult,
          carUpdateResult,
        });
      } catch (error) {
        console.error('Error updating collections:', error);
        res.status(500).send({ error: 'Failed to update collections' });
      }
    });
    
   

    // patch method for showing unavailable car 

    // app.patch('/booking-change-availability/:id', async (req, res) => {
    //   const id = req.params.id;
    //   const { availability } = req.body;

    //   const filter = { _id: new ObjectId(id) }
    //   const updatedAccept = {
    //     $set: {
    //       availability
    //     }
    //   }

    //   const result = await bookingsCollection.updateOne(filter, updatedAccept)
    //   console.log(result)
    //   res.send(result)
    // })

    


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('The car rebter website is running')
})


app.listen(port, () => {
  console.log(`The server is running on the port ${port}`)
})
