/**
 * Emergency Alert Model (Schema Blueprint)
 *
 * NOTE: MongoDB is deliberately not connected in Step 1 per project requirements.
 * This file serves as the architectural contract for Step 2+ cloud persistence.
 *
 * Schema Blueprint:
 * - alertId: String (UUID v4)
 * - userId: ObjectId (ref: 'User')
 * - emergencyType: String (Enum: 'medical', 'accident', 'safety', 'fire', 'other')
 * - location: {
 *     latitude: Number,
 *     longitude: Number,
 *     accuracy: Number,
 *     timestamp: Date
 *   }
 * - description: String
 * - contactNumber: String
 * - hopsCount: Number (BLE relay hop counter)
 * - relayedBy: [String] (List of device UUIDs that forwarded the packet)
 * - status: String (Enum: 'draft', 'broadcasted', 'relayed', 'cloud_synced', 'resolved')
 * - createdAt: Date
 * - updatedAt: Date
 */

module.exports = {
  modelName: 'EmergencyAlert',
  status: 'Placeholder awaiting MongoDB setup in Step 2',
};
