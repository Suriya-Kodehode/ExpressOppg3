import express from 'express';
var router = express.Router();

import { userSignup } from '../controller/userSignup.js';
import { userGet } from '../controller/userGet.js';
import { userLogin } from '../controller/userLogin.js';
import { userEdit } from '../controller/userEdit.js';
import { userProfile } from '../controller/userProfile.js';

import authToken from '../util/authToken.js';

router.get('/user', userGet);
router.post('/user/create', userSignup)
router.post('/user/login', userLogin)
router.put('/user/edit', authToken, userEdit)
router.get('/user/profile', authToken, userProfile)

export default router;
