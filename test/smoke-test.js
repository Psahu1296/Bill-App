#!/usr/bin/env node

/**
 * Simple smoke test for the POS backend
 * Tests health endpoint and basic user registration/login flow
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';

async function testHealthEndpoint() {
    try {
        console.log('🔍 Testing health endpoint...');
        const response = await fetch(`${BASE_URL}/health`);
        
        if (!response.ok) {
            throw new Error(`Health endpoint returned ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Health endpoint OK:', {
            status: data.status,
            environment: data.environment,
            port: data.port
        });
        
        return true;
    } catch (error) {
        console.error('❌ Health endpoint failed:', error.message);
        return false;
    }
}

async function testUserRegistration() {
    try {
        console.log('🔍 Testing user registration...');
        
        const userData = {
            name: 'Test User',
            email: 'test@example.com',
            password: 'password123',
            phone: '1234567890',
            role: 'waiter'
        };

        const response = await fetch(`${BASE_URL}/api/user/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Registration failed: ${response.status} - ${error}`);
        }

        const data = await response.json();
        console.log('✅ User registration OK:', {
            success: data.success,
            message: data.message,
            userId: data.data?.id
        });

        return { success: true, userId: data.data?.id };
    } catch (error) {
        console.error('❌ User registration failed:', error.message);
        return { success: false, error: error.message };
    }
}

async function testUserLogin(userId) {
    try {
        console.log('🔍 Testing user login...');
        
        const loginData = {
            email: 'test@example.com',
            password: 'password123'
        };

        const response = await fetch(`${BASE_URL}/api/user/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(loginData)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Login failed: ${response.status} - ${error}`);
        }

        const data = await response.json();
        console.log('✅ User login OK:', {
            success: data.success,
            message: data.message,
            token: 'set in cookie'
        });

        // Extract token from cookie (it's set as httpOnly cookie)
        const token = response.headers.get('set-cookie')?.match(/accessToken=([^;]+)/)?.[1];
        return { success: true, token };
    } catch (error) {
        console.error('❌ User login failed:', error.message);
        return { success: false, error: error.message };
    }
}

async function testProtectedEndpoint(token) {
    try {
        console.log('🔍 Testing protected endpoint...');
        
        const response = await fetch(`${BASE_URL}/api/user`, {
            method: 'GET',
            headers: {
                'Cookie': `token=${token}`,
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Protected endpoint failed: ${response.status} - ${error}`);
        }

        const data = await response.json();
        console.log('✅ Protected endpoint OK:', {
            success: data.success,
            user: data.data?.name
        });

        return true;
    } catch (error) {
        console.error('❌ Protected endpoint failed:', error.message);
        return false;
    }
}

async function cleanupTestData() {
    try {
        console.log('🧹 Cleaning up test data...');
        
        // This would normally delete the test user, but for now we'll just log
        console.log('ℹ️  Test data cleanup skipped (would normally delete test user)');
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
    }
}

async function main() {
    console.log('🚀 Starting POS backend smoke tests...\n');

    let allTestsPassed = true;
    let testResults = {};

    // Test 1: Health endpoint
    testResults.health = await testHealthEndpoint();
    if (!testResults.health) allTestsPassed = false;

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 2: User registration
    testResults.registration = await testUserRegistration();
    if (!testResults.registration.success) allTestsPassed = false;

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 3: User login (only if registration succeeded)
    if (testResults.registration.success) {
        testResults.login = await testUserLogin(testResults.registration.userId);
        if (!testResults.login.success) allTestsPassed = false;

        console.log('\n' + '='.repeat(50) + '\n');

        // Test 4: Protected endpoint (only if login succeeded)
        if (testResults.login.success) {
            testResults.protected = await testProtectedEndpoint(testResults.login.token);
            if (!testResults.protected) allTestsPassed = false;
        }
    }

    // Cleanup
    await cleanupTestData();

    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Results Summary:');
    console.log('='.repeat(50));

    Object.entries(testResults).forEach(([test, result]) => {
        const status = result.success ? '✅ PASS' : '❌ FAIL';
        const details = typeof result === 'boolean' ? '' : ` - ${result.error || 'OK'}`;
        console.log(`${status} ${test.toUpperCase()}${details}`);
    });

    console.log('\n' + '='.repeat(50));
    if (allTestsPassed) {
        console.log('🎉 ALL TESTS PASSED!');
        process.exit(0);
    } else {
        console.log('💥 SOME TESTS FAILED!');
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

main().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
});