const bcrypt = require('bcrypt')
const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

// Initialize DB and Server
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running on port 3000')
    })
  } catch (e) {
    console.log('DB Error')
    process.exit(1)
  }
}
initializeDBAndServer()

// JWT Authentication Middleware
const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

// Login API
app.post('/login', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//GET States API

app.get('/states', async (request, response) => {
  const stateslist = 'SELECT * FROM state'
  const result = await db.all(stateslist)
  response.send(result)
})

//GET State API

app.get('/states/:stateId', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const stateQuery = `SELECT * FROM state WHERE state_id='${stateId}';`
  const dbResponse = await db.get(stateQuery)

  if (dbResponse) {
    const result = {
      stateId: dbResponse.state_id,
      stateName: dbResponse.state_name,
      population: dbResponse.population,
    }
    response.send(result)
  } else {
    response.status(404).send('State not found')
  }
})

// POST District API
app.post('/districts', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const addDistrictQuery = `
    INSERT INTO district (district_name, state_id, cases, cured, active, deaths) 
    VALUES ('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}', '${deaths}');`
  const result = await db.run(addDistrictQuery)
  response.send('District Successfully Added')
})

// GET District API
app.get('/districts/:districtId', async (request, response) => {
  const {districtId} = request.params
  const districtlist = `SELECT * FROM district WHERE district_id='${districtId}';`
  const result = await db.get(districtlist)
  response.send(result)
})

// DELETE District API
app.delete(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = '${districtId}';`
    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

// PUT Update District API (Modified from POST to PUT)
app.put(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDistrictQuery = `
    UPDATE district 
    SET district_name='${districtName}', state_id='${stateId}', cases='${cases}', cured='${cured}', active='${active}', deaths='${deaths}' 
    WHERE district_id='${districtId}';`
    await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

// GET Stats API (Grouped by State)
app.get(
  '/states/:stateId/stats',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const statsQuery = `
    SELECT 
      SUM(cases) AS totalCases, 
      SUM(cured) AS totalCured, 
      SUM(active) AS totalActive, 
      SUM(deaths) AS totalDeaths 
    FROM 
      district 
    WHERE 
      state_id='${stateId}' 
    GROUP BY 
      state_id;`
    const result = await db.get(statsQuery)
    response.send(result)
  },
)

module.exports = app
