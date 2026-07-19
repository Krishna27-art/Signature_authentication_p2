/* =========================================================
   user_manager.js — Multi-User Management for Real-User Testing
   Supports 20-50 users with multi-session signature collection
   ========================================================= */

import { BDB } from './biometrics';

// User database structure
export const USER_DB_KEY = 'user_registry';

/**
 * Get user profile (sync helper for UI components)
 */
export function getUserProfile(userId) {
    return {
        id: userId,
        name: userId === 'primary_user' ? 'Primary User' : userId,
        metadata: { handedness: 'right', device: 'touch' }
    };
}


/**
 * Initialize user registry if not exists
 */
export async function initUserRegistry() {
    const registry = await BDB.get(USER_DB_KEY, null);
    if (!registry) {
        await BDB.set(USER_DB_KEY, {
            users: [],
            currentUser: null,
            createdAt: Date.now()
        });
    }
}

/**
 * Get all users
 */
export async function getAllUsers() {
    await initUserRegistry();
    const registry = await BDB.get(USER_DB_KEY);
    return registry.users || [];
}

/**
 * Get current user
 */
export async function getCurrentUser() {
    await initUserRegistry();
    const registry = await BDB.get(USER_DB_KEY);
    return registry.currentUser;
}

/**
 * Create a new user
 */
export async function createUser(userId, metadata = {}) {
    await initUserRegistry();
    const registry = await BDB.get(USER_DB_KEY);
    
    // Check if user already exists
    if (registry.users.find(u => u.id === userId)) {
        throw new Error(`User ${userId} already exists`);
    }
    
    const newUser = {
        id: userId,
        createdAt: Date.now(),
        metadata: {
            age: metadata.age || null,
            gender: metadata.gender || null,
            handedness: metadata.handedness || null,
            device: metadata.device || null,
            ...metadata
        },
        sessions: [],
        isEnrolled: false,
        enrollmentDate: null
    };
    
    registry.users.push(newUser);
    await BDB.set(USER_DB_KEY, registry);
    
    return newUser;
}

/**
 * Select a user as current
 */
export async function selectUser(userId) {
    await initUserRegistry();
    const registry = await BDB.get(USER_DB_KEY);
    
    const user = registry.users.find(u => u.id === userId);
    if (!user) {
        throw new Error(`User ${userId} not found`);
    }
    
    registry.currentUser = userId;
    await BDB.set(USER_DB_KEY, registry);
    
    // Load user's biometric data
    await loadUserData(userId);
    
    return user;
}

/**
 * Mark user as enrolled
 */
export async function markUserEnrolled(userId) {
    await initUserRegistry();
    const registry = await BDB.get(USER_DB_KEY);
    
    const user = registry.users.find(u => u.id === userId);
    if (!user) {
        throw new Error(`User ${userId} not found`);
    }
    
    user.isEnrolled = true;
    user.enrollmentDate = Date.now();
    
    await BDB.set(USER_DB_KEY, registry);
}

/**
 * Add a session for a user
 */
export async function addSession(userId, sessionData) {
    await initUserRegistry();
    const registry = await BDB.get(USER_DB_KEY);
    
    const user = registry.users.find(u => u.id === userId);
    if (!user) {
        throw new Error(`User ${userId} not found`);
    }
    
    const session = {
        id: `session_${Date.now()}`,
        timestamp: Date.now(),
        device: sessionData.device || await getDeviceInfo(),
        signatures: sessionData.signatures || [],
        verifications: sessionData.verifications || [],
        ...sessionData
    };
    
    user.sessions.push(session);
    await BDB.set(USER_DB_KEY, registry);
    
    return session;
}

/**
 * Get user's session history
 */
export async function getUserSessions(userId) {
    await initUserRegistry();
    const registry = await BDB.get(USER_DB_KEY);
    
    const user = registry.users.find(u => u.id === userId);
    if (!user) {
        throw new Error(`User ${userId} not found`);
    }
    
    return user.sessions || [];
}

/**
 * Load user's biometric data into main storage
 */
async function loadUserData(userId) {
    const userKey = `user_data_${userId}`;
    const userData = await BDB.get(userKey, null);
    
    if (userData) {
        await BDB.set('bio_state', userData.bioState);
        await BDB.set('partials', userData.partials || []);
    } else {
        // Clear existing data
        await BDB.set('bio_state', null);
        await BDB.set('partials', []);
    }
}

/**
 * Save user's biometric data
 */
export async function saveUserData(userId) {
    const bioState = await BDB.get('bio_state', null);
    const partials = await BDB.get('partials', []);
    
    const userKey = `user_data_${userId}`;
    await BDB.set(userKey, {
        bioState,
        partials,
        lastUpdated: Date.now()
    });
}

/**
 * Delete a user
 */
export async function deleteUser(userId) {
    await initUserRegistry();
    const registry = await BDB.get(USER_DB_KEY);
    
    registry.users = registry.users.filter(u => u.id !== userId);
    
    if (registry.currentUser === userId) {
        registry.currentUser = null;
    }
    
    await BDB.set(USER_DB_KEY, registry);
    
    // Delete user's biometric data
    const userKey = `user_data_${userId}`;
    await BDB.del(userKey);
}

/**
 * Export all user data for research
 */
export async function exportUserData() {
    await initUserRegistry();
    const registry = await BDB.get(USER_DB_KEY);
    
    const exportData = {
        exportDate: Date.now(),
        userCount: registry.users.length,
        users: []
    };
    
    for (const user of registry.users) {
        const userKey = `user_data_${user.id}`;
        const userData = await BDB.get(userKey, null);
        
        exportData.users.push({
            userInfo: user,
            biometricData: userData
        });
    }
    
    return exportData;
}

/**
 * Import user data
 */
export async function importUserData(importData) {
    await initUserRegistry();
    const registry = await BDB.get(USER_DB_KEY);
    
    for (const userImport of importData.users) {
        const { userInfo, biometricData } = userImport;
        
        // Check if user exists
        const existingUser = registry.users.find(u => u.id === userInfo.id);
        if (existingUser) {
            // Update existing user
            Object.assign(existingUser, userInfo);
        } else {
            // Add new user
            registry.users.push(userInfo);
        }
        
        // Save biometric data
        const userKey = `user_data_${userInfo.id}`;
        await BDB.set(userKey, biometricData);
    }
    
    await BDB.set(USER_DB_KEY, registry);
}

/**
 * Get device information
 */
async function getDeviceInfo() {
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency,
        touchSupport: 'ontouchstart' in window,
        screen: {
            width: screen.width,
            height: screen.height,
            colorDepth: screen.colorDepth
        }
    };
}

/**
 * Get user statistics
 */
export async function getUserStatistics() {
    const users = await getAllUsers();
    
    const stats = {
        totalUsers: users.length,
        enrolledUsers: users.filter(u => u.isEnrolled).length,
        totalSessions: users.reduce((sum, u) => sum + (u.sessions?.length || 0), 0),
        usersByDevice: {},
        usersByHandedness: {},
        avgSessionsPerUser: 0
    };
    
    if (users.length > 0) {
        stats.avgSessionsPerUser = stats.totalSessions / users.length;
    }
    
    users.forEach(user => {
        const device = user.metadata?.device || 'unknown';
        stats.usersByDevice[device] = (stats.usersByDevice[device] || 0) + 1;
        
        const handedness = user.metadata?.handedness || 'unknown';
        stats.usersByHandedness[handedness] = (stats.usersByHandedness[handedness] || 0) + 1;
    });
    
    return stats;
}
