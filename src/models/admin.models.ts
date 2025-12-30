import { Document, model, models, Schema } from "mongoose";

export interface IAdmin extends Document {
    name: string;
    email: string;
    password?: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
}

const AdminSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        select: false // Do not return password by default
    },
    role: {
        type: String,
        default: 'admin',
        enum: ['admin', 'superadmin']
    }
}, {
    timestamps: true
});

const Admin = models.Admin ?? model<IAdmin>("Admin", AdminSchema);
export default Admin;
