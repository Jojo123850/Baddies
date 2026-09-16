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
// describe: regroupe les tests liés, test défini le test individuel,
//  before: setup avant chaque test
//  after: nettoyage après chaque test
// lancer test: package: script => test=> node --test
describe('Auth Test Unit', () => {

    let userA, userC
    const testEmails = ['test1_@example.com', 'test2_u@example.com','test3_@example.com' ]
    

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

    test('Register: Register user with email, pseudo, strong password', async () => {
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
    })

    test(':Register verify  with user B', async() => {
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
    }) 

     test('Register:Duplicate email', async() => {
         // Duplicate email check
         const reqA= {
                body: {
                    email: 'test2_u@example.com',
                    password: 'Password123!',
                    pseudo: 'Jojo'
                }
        }
         const resDup = createMockRes()
         await register(reqA, resDup)
         assert.strictEqual(resDup.statusCode, 400)
     })


     test( 'Register :weak password', async() => {
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
  

    test('Login: get secure token', async () => {
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

    test('Login: Wrong mail', async() => {
        // wrong mail
        const reqWrgMail = {
            body:{
                email: 'test0_@example.com',
                password:'Password123!'
            }
        }
        const resWrgMail = createMockRes()
        await login(reqWrgMail, resWrgMail)
        assert.strictEqual(resWrgMail.statusCode, 401)
       
    })
     test('Login: Wrong passWord', async() => {
        // wrong mail
        const reqWrgPassword = {
            body:{
                email: 'test1_@example.com',
                password:'Password423!'
            }
        }
        const resWrgPassword = createMockRes()
        await login(reqWrgPassword, resWrgPassword)
        assert.strictEqual(resWrgPassword.statusCode, 401)
    })


    test('Login:No mail', async() => {
        // no mail
        const reqNoemail = {
            body:{
                email: '',
                password: 'Password123!'
            }
        }
            const resNoemail = createMockRes()
            await login(reqNoemail,  resNoemail)
            assert.strictEqual(resNoemail.statusCode, 400)
    })

    test('Login: No password', async() => {
        // no password
        const reqNoPassword = {
            body: {
                email: 'test1_@example.com',
                password: ''
            }
        }
            const resNoPassword = createMockRes()
            await login(reqNoPassword, resNoPassword)
            assert.strictEqual(resNoPassword.statusCode, 400)
    })
        
    

   test('UpdateProfile: update profile', async () => {
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

    test('UpdateProfile: wrong mail', async() => {
        const reqUptMail = {
            user: { id: userA.id },
            body: {
                email: 'test0_@example.com',
                password: 'UpdateTest123!'
            }
        }
                const resUptMail = createMockRes()
                await updateProfile(reqUptMail, resUptMail)
                assert.strictEqual(resUptMail.statusCode, 200)
                assert.strictEqual(resUptMail.body.user.email, 'test0_@example.com')
             
                
    })
    test('UpdateProfile: wrong password', async() => {
        const reqUptMail = {
            user:{id: userA.id},
            body: {
                email: 'test1_@example.com',
                password: 'UpdateTest423!'
            }
        }
                const resUptMail = createMockRes()
                await updateProfile(reqUptMail, resUptMail)
                assert.strictEqual(resUptMail.statusCode,200)
                
    })

     test('UpdateProfile: duplicate mail', async () => {
         const reqA= {
            user: {id: userA.id},
            body: {
                     email: 'test2_u@example.com',
                     password: 'Password123!'
                 }
             }
          const resDup = createMockRes()
          await register(reqA, resDup)
          assert.strictEqual(resDup.statusCode, 400)

     })

      test( 'UpdateProfile :weak password', async() => {
         // weak password
         const reqWeakPass = {
            user: {id: userA.id},
             body: {
                 email: 'test1_@example.com',
                 password: 'password123!',
             }
         }
         const resWeakPass = createMockRes()
         await register(reqWeakPass, resWeakPass)
         assert.strictEqual(resWeakPass.statusCode, 400)
         userC = resWeakPass.body.user
      })
    
})