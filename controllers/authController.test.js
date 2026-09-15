const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
require('dotenv').config()

const { pool } = require('../config/db') 

const { register, login, updateProfile } = require('../controllers/authController')

const createMockRes = () => {
    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code
            return this
        },
        json(data) {
            this.body = data
            return this
        }
    }
    return res
}

describe('Test unitaire', () => {

    let userA
    const testEmails = ['test1_@example.com', 'test2_u@example.com']

    before(async () => {
        await pool.query(
            'DELETE FROM "Users" WHERE "email" = ANY($1)', [testEmails]
        )
    })

    after(async () => {
        await pool.query(
            'DELETE FROM "Users" WHERE "email" = ANY($1)', [testEmails]
        )
        await pool.end()
    })

    test('US1: Register user with email, pseudo, strong password', async () => {
        const reqA = {
            body: {
                email: 'test1_@example.com',
                password: 'Password123!',
                pseudo: 'Giovanie'
            }
        }
        const resA = createMockRes()
        await register(reqA, resA)
        assert.strictEqual(resA.statusCode, 201)
        assert.ok(resA.body.token)
        userA = resA.body.user

        // Register user B
        const reqB = {
            body: {
                email: 'test2_u@example.com',
                password: 'Password123!',
                pseudo: 'Jojo'
            }
        }
        const resB = createMockRes()
        await register(reqB, resB)
        assert.strictEqual(resB.statusCode, 201)
        userB = resB.body.user

        // Duplicate email check
        const resDup = createMockRes()
        await register(reqA, resDup)
        assert.strictEqual(resDup.statusCode, 400)


        // weak password
        const reqC = {
            body: {
                email: 'test3_@example.com',
                password: 'Passwordtest3',
                pseudo: 'Gyneco'
            }
        }
        const resC = createMockRes()
        await register(reqC, resC)
        assert.strictEqual(resC.statusCode, 400)
        userC = resC.body.user
    })

    test('US2: Login user to get secure token', async () => {
        const req = {
            body: {
                email: 'test1_@example.com',
                password: 'Password123!'
            }
        }
        const res = createMockRes()
        await login(req, res)
        assert.strictEqual(res.statusCode, 200)
        assert.ok(res.body.token)
        tokenA = res.body.token
    })

   test('US3: update profile', async () => {
    const req = {
        user: { id: userA.id },
        body: {
            email: 'test1_@example.com',
            password: 'UpdateTest123!'
        }
    }
    const res = createMockRes()
    await updateProfile(req, res)
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.body.user.email, 'test1_@example.com')
})
    
})